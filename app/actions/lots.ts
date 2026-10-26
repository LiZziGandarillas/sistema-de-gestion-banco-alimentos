'use server'

import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { lots, movements } from '@/lib/db/schema'
import { ActionError, requireVolunteer } from '@/lib/session'
import { runAction, isUniqueViolation } from '@/lib/action-result'
import { CATEGORIES, UNITS, addDays, todayISO } from '@/lib/domain'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escriba una fecha válida.')
const quantity = z
  .number({ message: 'Escriba una cantidad.' })
  .positive('La cantidad debe ser mayor que cero.')
  .max(100000, 'La cantidad es demasiado grande. Revise el número.')
  .refine((n) => Math.round(n * 100) === n * 100, 'Use como máximo dos decimales.')
const reason = z.string().trim().min(3, 'Escriba el motivo (al menos 3 letras).').max(500)

const donationSchema = z.object({
  idempotencyKey: z.string().uuid(),
  receivedAt: isoDate,
  items: z
    .array(
      z
        .object({
          name: z.string().trim().min(2, 'Escriba el nombre de cada producto.').max(120),
          category: z.enum(CATEGORIES, { message: 'Elija una categoría.' }),
          unit: z.enum(UNITS, { message: 'Elija una unidad.' }),
          quantity,
          expiresAt: isoDate.nullable(),
          expiryUnknown: z.boolean(),
          notes: z.string().trim().max(500).optional(),
        })
        .refine((i) => i.expiryUnknown || i.expiresAt, {
          message: 'Escriba la fecha de caducidad o marque “No tiene fecha visible”.',
        }),
    )
    .min(1, 'Añada al menos un producto.')
    .max(40, 'Registre como máximo 40 productos de una vez.'),
})

export async function createDonation(input: z.input<typeof donationSchema>) {
  return runAction(async () => {
    const v = await requireVolunteer()
    const data = donationSchema.parse(input)
    const today = todayISO()
    if (data.receivedAt > today) throw new ActionError('La fecha de recepción no puede ser futura.')
    if (data.receivedAt < addDays(today, -60)) throw new ActionError('La fecha de recepción es demasiado antigua. Revise la fecha.')

    const firstKey = `${data.idempotencyKey}:0`
    const [already] = await db.select({ id: lots.id }).from(lots).where(eq(lots.idempotencyKey, firstKey))
    if (already) return { message: 'Esta donación ya estaba guardada. No se ha duplicado.' }

    try {
      const codes = await db.transaction(async (tx) => {
        const created: string[] = []
        for (const [index, item] of data.items.entries()) {
          const {
            rows: [{ id }],
          } = await tx.execute<{ id: number }>(sql`SELECT nextval('lots_id_seq')::int AS id`)
          const code = `L-${String(id).padStart(5, '0')}`
          await tx.insert(lots).values({
            id,
            code,
            name: item.name,
            category: item.category,
            unit: item.unit,
            quantityReceived: item.quantity,
            quantityAvailable: item.quantity,
            receivedAt: data.receivedAt,
            expiresAt: item.expiryUnknown ? null : item.expiresAt,
            expiryUnknown: item.expiryUnknown,
            notes: item.notes || null,
            idempotencyKey: `${data.idempotencyKey}:${index}`,
            createdBy: v.id,
          })
          await tx.insert(movements).values({
            lotId: id,
            type: 'entrada',
            quantity: item.quantity,
            reason: 'Donación recibida',
            createdBy: v.id,
          })
          created.push(code)
        }
        return created
      })
      revalidatePath('/', 'layout')
      return { message: `Donación guardada. Códigos de lote: ${codes.join(', ')}. Escríbalos en las cajas.` }
    } catch (e) {
      if (isUniqueViolation(e)) return { message: 'Esta donación ya estaba guardada. No se ha duplicado.' }
      throw e
    }
  })
}

const discardSchema = z.object({ lotId: z.number().int().positive(), quantity, reason })

export async function discardFromLot(input: z.input<typeof discardSchema>) {
  return runAction(async () => {
    const v = await requireVolunteer()
    const data = discardSchema.parse(input)
    await db.transaction(async (tx) => {
      const [lot] = await tx.select().from(lots).where(eq(lots.id, data.lotId)).for('update')
      if (!lot) throw new ActionError('No se encuentra el lote.')
      if (data.quantity > lot.quantityAvailable) {
        throw new ActionError(`Solo quedan ${lot.quantityAvailable} ${lot.unit} en este lote.`)
      }
      const remaining = Math.round((lot.quantityAvailable - data.quantity) * 100) / 100
      await tx
        .update(lots)
        .set({ quantityAvailable: remaining, status: remaining === 0 ? 'descartado' : lot.status })
        .where(eq(lots.id, lot.id))
      await tx.insert(movements).values({
        lotId: lot.id,
        type: 'descarte',
        quantity: -data.quantity,
        reason: data.reason,
        createdBy: v.id,
      })
    })
    revalidatePath('/', 'layout')
    return { message: 'Descarte registrado. Queda guardado en el historial del lote.' }
  })
}

const reviewSchema = z.object({
  lotId: z.number().int().positive(),
  decision: z.enum(['apto', 'descartar']),
  note: reason,
})

/** A person checks the product physically. "apto" keeps it available; "descartar" removes all remaining stock. */
export async function reviewLot(input: z.input<typeof reviewSchema>) {
  return runAction(async () => {
    const v = await requireVolunteer()
    const data = reviewSchema.parse(input)
    const today = todayISO()
    await db.transaction(async (tx) => {
      const [lot] = await tx.select().from(lots).where(eq(lots.id, data.lotId)).for('update')
      if (!lot) throw new ActionError('No se encuentra el lote.')
      if (lot.status !== 'disponible') throw new ActionError('Este lote ya no está disponible.')
      if (data.decision === 'apto') {
        await tx.update(lots).set({ lastReviewedAt: today }).where(eq(lots.id, lot.id))
        await tx.execute(
          sql`UPDATE lots SET notes = concat_ws(E'\n', notes, ${`Revisado ${today}: ${data.note}`}) WHERE id = ${lot.id}`,
        )
      } else {
        const expired = lot.expiresAt !== null && lot.expiresAt < today
        await tx
          .update(lots)
          .set({ quantityAvailable: 0, status: expired ? 'vencido' : 'descartado', lastReviewedAt: today })
          .where(eq(lots.id, lot.id))
        if (lot.quantityAvailable > 0) {
          await tx.insert(movements).values({
            lotId: lot.id,
            type: 'descarte',
            quantity: -lot.quantityAvailable,
            reason: `Revisión: ${data.note}`,
            createdBy: v.id,
          })
        }
      }
    })
    revalidatePath('/', 'layout')
    return {
      message:
        data.decision === 'apto'
          ? 'Revisión guardada. El producto sigue disponible.'
          : 'Producto retirado. Queda guardado en el historial.',
    }
  })
}
