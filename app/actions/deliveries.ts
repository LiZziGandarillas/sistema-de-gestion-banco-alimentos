'use server'

import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { deliveries, deliveryItems, families, lots, movements } from '@/lib/db/schema'
import { ActionError, getSettings, requireCoordinator, requireVolunteer } from '@/lib/session'
import { runAction, isUniqueViolation } from '@/lib/action-result'
import { canDeliver, currentPeriod, formatDateTime, lotAlert } from '@/lib/domain'

const qty = z
  .number({ message: 'Escriba una cantidad.' })
  .positive('La cantidad debe ser mayor que cero.')
  .max(1000, 'La cantidad es demasiado grande. Revise el número.')
  .refine((n) => Math.round(n * 100) === n * 100, 'Use como máximo dos decimales.')

const deliverySchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    familyId: z.number().int().positive('Elija una familia.'),
    items: z
      .array(z.object({ lotId: z.number().int().positive(), quantity: qty }))
      .min(1, 'Añada al menos un producto a la entrega.')
      .max(30, 'Como máximo 30 productos por entrega.'),
    isException: z.boolean(),
    exceptionReason: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((d) => new Set(d.items.map((i) => i.lotId)).size === d.items.length, {
    message: 'Hay un producto repetido. Junte las cantidades en una sola línea.',
  })
  .refine((d) => !d.isException || (d.exceptionReason?.length ?? 0) >= 5, {
    message: 'Explique el motivo de la excepción (al menos 5 letras).',
  })

export async function createDelivery(input: z.input<typeof deliverySchema>) {
  return runAction<{ deliveryId: number }>(async () => {
    const v = await requireVolunteer()
    const data = deliverySchema.parse(input)
    const s = await getSettings()
    const period = currentPeriod(s)

    const [existing] = await db
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(eq(deliveries.idempotencyKey, data.idempotencyKey))
    if (existing) return { message: 'Esta entrega ya estaba guardada. No se ha duplicado.', data: { deliveryId: existing.id } }

    try {
      const deliveryId = await db.transaction(async (tx) => {
        // Serialises concurrent deliveries for the same family so the one-per-period rule holds.
        const [family] = await tx.select().from(families).where(eq(families.id, data.familyId)).for('update')
        if (!family) throw new ActionError('No se encuentra la familia.')
        if (family.status !== 'activa') throw new ActionError('Esta familia está inactiva. Pida a la coordinación que la revise.')

        const [previous] = await tx
          .select({ id: deliveries.id, deliveredAt: deliveries.deliveredAt })
          .from(deliveries)
          .where(
            and(
              eq(deliveries.familyId, family.id),
              eq(deliveries.periodStart, period.start),
              eq(deliveries.status, 'registrada'),
            ),
          )
        if (previous && !data.isException) {
          throw new ActionError(
            `Esta familia ya recibió una entrega en este periodo (${formatDateTime(previous.deliveredAt)}). Si es una necesidad urgente, marque “Entrega excepcional” y explique el motivo.`,
          )
        }

        const lotIds = data.items.map((i) => i.lotId)
        const locked = await tx.select().from(lots).where(inArray(lots.id, lotIds)).orderBy(lots.id).for('update')
        const byId = new Map(locked.map((l) => [l.id, l]))

        for (const item of data.items) {
          const lot = byId.get(item.lotId)
          if (!lot) throw new ActionError('Uno de los productos ya no existe. Recargue la página.')
          const alert = lotAlert(lot, s)
          if (!canDeliver(alert)) {
            throw new ActionError(`El lote ${lot.code} (${lot.name}) no se puede entregar: ${alert.label.toLowerCase()}.`)
          }
          if (item.quantity > lot.quantityAvailable) {
            throw new ActionError(
              `No hay suficiente ${lot.name} (lote ${lot.code}). Quedan ${lot.quantityAvailable} ${lot.unit}. Otra persona puede haberlo entregado hace un momento.`,
            )
          }
        }

        const [delivery] = await tx
          .insert(deliveries)
          .values({
            familyId: family.id,
            periodStart: period.start,
            isException: data.isException,
            exceptionReason: data.isException ? data.exceptionReason : null,
            notes: data.notes || null,
            idempotencyKey: data.idempotencyKey,
            createdBy: v.id,
          })
          .returning({ id: deliveries.id })

        for (const item of data.items) {
          const lot = byId.get(item.lotId)!
          const remaining = Math.round((lot.quantityAvailable - item.quantity) * 100) / 100
          await tx
            .update(lots)
            .set({ quantityAvailable: remaining, status: remaining === 0 ? 'distribuido' : 'disponible' })
            .where(eq(lots.id, lot.id))
          await tx.insert(deliveryItems).values({
            deliveryId: delivery.id,
            lotId: lot.id,
            quantity: item.quantity,
            originalQuantity: item.quantity,
          })
          await tx.insert(movements).values({
            lotId: lot.id,
            type: 'entrega',
            quantity: -item.quantity,
            deliveryId: delivery.id,
            reason: `Entrega a familia ${family.code}`,
            createdBy: v.id,
          })
        }
        return delivery.id
      })
      revalidatePath('/', 'layout')
      return { message: 'Entrega registrada correctamente.', data: { deliveryId } }
    } catch (e) {
      if (isUniqueViolation(e)) {
        const [row] = await db
          .select({ id: deliveries.id })
          .from(deliveries)
          .where(eq(deliveries.idempotencyKey, data.idempotencyKey))
        if (row) return { message: 'Esta entrega ya estaba guardada. No se ha duplicado.', data: { deliveryId: row.id } }
      }
      throw e
    }
  })
}

const correctSchema = z.object({
  itemId: z.number().int().positive(),
  newQuantity: z
    .number({ message: 'Escriba la cantidad correcta.' })
    .min(0, 'La cantidad no puede ser negativa.')
    .max(1000)
    .refine((n) => Math.round(n * 100) === n * 100, 'Use como máximo dos decimales.'),
  reason: z.string().trim().min(5, 'Explique el motivo de la corrección (al menos 5 letras).').max(500),
})

/** Corrects a quantity typed by mistake. The original value and the correction stay in the history. */
export async function correctDeliveryItem(input: z.input<typeof correctSchema>) {
  return runAction(async () => {
    const v = await requireVolunteer()
    const data = correctSchema.parse(input)
    await db.transaction(async (tx) => {
      const [item] = await tx.select().from(deliveryItems).where(eq(deliveryItems.id, data.itemId)).for('update')
      if (!item) throw new ActionError('No se encuentra la línea de la entrega.')
      const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, item.deliveryId))
      if (delivery.status !== 'registrada') throw new ActionError('Esta entrega está anulada y no se puede corregir.')
      const delta = Math.round((item.quantity - data.newQuantity) * 100) / 100
      if (delta === 0) throw new ActionError('La cantidad nueva es igual a la actual.')

      const [lot] = await tx.select().from(lots).where(eq(lots.id, item.lotId)).for('update')
      const available = Math.round((lot.quantityAvailable + delta) * 100) / 100
      if (available < 0) {
        throw new ActionError(`No hay suficiente ${lot.name} para aumentar la entrega. Quedan ${lot.quantityAvailable} ${lot.unit}.`)
      }
      if (available > lot.quantityReceived) throw new ActionError('La corrección deja más existencias de las recibidas. Revise el número.')

      await tx.update(deliveryItems).set({ quantity: data.newQuantity }).where(eq(deliveryItems.id, item.id))
      await tx
        .update(lots)
        .set({
          quantityAvailable: available,
          status:
            available === 0 ? 'distribuido' : lot.status === 'distribuido' ? 'disponible' : lot.status,
        })
        .where(eq(lots.id, lot.id))
      await tx.insert(movements).values({
        lotId: lot.id,
        type: 'correccion',
        quantity: delta,
        deliveryId: delivery.id,
        reason: `De ${item.quantity} a ${data.newQuantity}: ${data.reason}`,
        createdBy: v.id,
      })
    })
    revalidatePath('/', 'layout')
    return { message: 'Corrección guardada. El inventario se ha actualizado.' }
  })
}

const voidSchema = z.object({
  deliveryId: z.number().int().positive(),
  reason: z.string().trim().min(5, 'Explique por qué se anula (al menos 5 letras).').max(500),
})

/** Cancels a whole delivery and returns its products to stock. Only coordinators. */
export async function voidDelivery(input: z.input<typeof voidSchema>) {
  return runAction(async () => {
    const v = await requireCoordinator()
    const data = voidSchema.parse(input)
    await db.transaction(async (tx) => {
      const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, data.deliveryId)).for('update')
      if (!delivery) throw new ActionError('No se encuentra la entrega.')
      if (delivery.status === 'anulada') throw new ActionError('Esta entrega ya estaba anulada.')
      const items = await tx.select().from(deliveryItems).where(eq(deliveryItems.deliveryId, delivery.id))
      for (const item of items) {
        if (item.quantity === 0) continue
        const [lot] = await tx.select().from(lots).where(eq(lots.id, item.lotId)).for('update')
        const available = Math.round((lot.quantityAvailable + item.quantity) * 100) / 100
        await tx
          .update(lots)
          .set({ quantityAvailable: available, status: lot.status === 'distribuido' ? 'disponible' : lot.status })
          .where(eq(lots.id, lot.id))
        await tx.insert(movements).values({
          lotId: lot.id,
          type: 'anulacion',
          quantity: item.quantity,
          deliveryId: delivery.id,
          reason: `Entrega anulada: ${data.reason}`,
          createdBy: v.id,
        })
      }
      await tx
        .update(deliveries)
        .set({ status: 'anulada', voidReason: data.reason, voidedBy: v.id, voidedAt: new Date() })
        .where(eq(deliveries.id, delivery.id))
    })
    revalidatePath('/', 'layout')
    return { message: 'Entrega anulada. Los productos han vuelto al inventario.' }
  })
}
