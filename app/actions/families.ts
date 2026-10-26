'use server'

import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { families } from '@/lib/db/schema'
import { ActionError, requireCoordinator, requireVolunteer } from '@/lib/session'
import { runAction } from '@/lib/action-result'

const familySchema = z.object({
  reference: z
    .string()
    .trim()
    .min(2, 'Escriba una referencia (por ejemplo, apellido o nombre de contacto).')
    .max(80, 'La referencia es demasiado larga.'),
  members: z
    .number({ message: 'Escriba cuántas personas viven en el hogar.' })
    .int('Escriba un número entero.')
    .min(1, 'Debe haber al menos una persona.')
    .max(20, 'Revise el número de personas.'),
  notes: z.string().trim().max(300, 'Las notas son demasiado largas.').optional(),
})

export async function createFamily(input: z.input<typeof familySchema>) {
  return runAction<{ id: number; code: string }>(async () => {
    const v = await requireVolunteer()
    const data = familySchema.parse(input)
    const result = await db.transaction(async (tx) => {
      const {
        rows: [{ id }],
      } = await tx.execute<{ id: number }>(sql`SELECT nextval('families_id_seq')::int AS id`)
      const code = `F-${String(id).padStart(4, '0')}`
      await tx.insert(families).values({
        id,
        code,
        reference: data.reference,
        members: data.members,
        notes: data.notes || null,
        createdBy: v.id,
      })
      return { id, code }
    })
    revalidatePath('/', 'layout')
    return { message: `Familia registrada con el código ${result.code}.`, data: result }
  })
}

const updateSchema = familySchema.extend({
  id: z.number().int().positive(),
  status: z.enum(['activa', 'inactiva']),
})

export async function updateFamily(input: z.input<typeof updateSchema>) {
  return runAction(async () => {
    const v = await requireVolunteer()
    const data = updateSchema.parse(input)
    const [current] = await db.select().from(families).where(eq(families.id, data.id))
    if (!current) throw new ActionError('No se encuentra la familia.')
    if (current.status !== data.status && v.role !== 'coordinador') {
      throw new ActionError('Solo la coordinación puede activar o desactivar familias.')
    }
    await db
      .update(families)
      .set({
        reference: data.reference,
        members: data.members,
        notes: data.notes || null,
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(families.id, data.id))
    revalidatePath('/', 'layout')
    return { message: 'Datos de la familia actualizados.' }
  })
}

/** Removes notes and pseudonymises the reference when a family leaves the programme. Delivery history is kept for totals. */
export async function anonymizeFamily(input: { id: number }) {
  return runAction(async () => {
    await requireCoordinator()
    const id = z.number().int().positive().parse(input.id)
    await db
      .update(families)
      .set({ reference: 'Datos eliminados', notes: null, status: 'inactiva', updatedAt: new Date() })
      .where(eq(families.id, id))
    revalidatePath('/', 'layout')
    return { message: 'Datos personales eliminados. El historial de entregas se conserva sin datos identificativos.' }
  })
}
