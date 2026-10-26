import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { settings, volunteers } from '@/lib/db/schema'

export type CurrentVolunteer = {
  id: string
  name: string
  email: string
  role: 'coordinador' | 'voluntario'
  active: boolean
}

export const getCurrentVolunteer = cache(async (): Promise<CurrentVolunteer | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const [row] = await db.select().from(volunteers).where(eq(volunteers.userId, session.user.id))
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: row?.role ?? 'voluntario',
    active: row?.active ?? false,
  }
})

/** For pages: redirects when the visitor is not an active volunteer. */
export async function requireVolunteerPage() {
  const v = await getCurrentVolunteer()
  if (!v) redirect('/sign-in')
  if (!v.active) redirect('/pendiente')
  return v
}

export async function requireCoordinatorPage() {
  const v = await requireVolunteerPage()
  if (v.role !== 'coordinador') redirect('/')
  return v
}

export class ActionError extends Error {}

/** For server actions: throws instead of redirecting so the form can show the message. */
export async function requireVolunteer() {
  const v = await getCurrentVolunteer()
  if (!v) throw new ActionError('Su sesión ha terminado. Vuelva a entrar con su correo y contraseña.')
  if (!v.active) throw new ActionError('Su cuenta todavía no está activada. Pida a la persona coordinadora que la active.')
  return v
}

export async function requireCoordinator() {
  const v = await requireVolunteer()
  if (v.role !== 'coordinador') throw new ActionError('Solo la persona coordinadora puede hacer esto.')
  return v
}

export const getSettings = cache(async () => {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1))
  return row
})
