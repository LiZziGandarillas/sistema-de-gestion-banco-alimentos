'use server'

import { z } from 'zod'
import { and, eq, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { settings, volunteers } from '@/lib/db/schema'
import { ActionError, requireCoordinator } from '@/lib/session'
import { runAction } from '@/lib/action-result'

const settingsSchema = z
  .object({
    periodDays: z.number().int().min(1, 'Mínimo 1 día.').max(90, 'Máximo 90 días.'),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escriba una fecha válida.'),
    soonDays: z.number().int().min(1).max(60),
    urgentDays: z.number().int().min(0).max(30),
    reviewDays: z.number().int().min(1).max(365),
  })
  .refine((s) => s.urgentDays < s.soonDays, {
    message: 'Los días de “distribuir primero” deben ser menos que los de “caduca pronto”.',
  })

export async function updateSettings(input: z.input<typeof settingsSchema>) {
  return runAction(async () => {
    const v = await requireCoordinator()
    const data = settingsSchema.parse(input)
    await db
      .update(settings)
      .set({ ...data, updatedAt: new Date(), updatedBy: v.id })
      .where(eq(settings.id, 1))
    revalidatePath('/', 'layout')
    return { message: 'Configuración guardada.' }
  })
}

const volunteerSchema = z.object({
  userId: z.string().min(1),
  active: z.boolean(),
  role: z.enum(['coordinador', 'voluntario']),
})

export async function updateVolunteer(input: z.input<typeof volunteerSchema>) {
  return runAction(async () => {
    const v = await requireCoordinator()
    const data = volunteerSchema.parse(input)
    if (data.userId === v.id && (!data.active || data.role !== 'coordinador')) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(volunteers)
        .where(and(eq(volunteers.role, 'coordinador'), eq(volunteers.active, true), ne(volunteers.userId, v.id)))
      if (count === 0) throw new ActionError('Debe quedar al menos otra persona coordinadora activa antes de cambiar su propia cuenta.')
    }
    await db
      .insert(volunteers)
      .values({ userId: data.userId, active: data.active, role: data.role })
      .onConflictDoUpdate({
        target: volunteers.userId,
        set: { active: data.active, role: data.role, updatedAt: new Date() },
      })
    revalidatePath('/ajustes')
    return { message: data.active ? 'Cuenta actualizada.' : 'Cuenta desactivada. Ya no podrá registrar operaciones.' }
  })
}
