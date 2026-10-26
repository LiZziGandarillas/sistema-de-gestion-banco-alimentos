import { ZodError } from 'zod'
import { ActionError } from '@/lib/session'

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string }

export async function runAction<T>(fn: () => Promise<{ message: string; data?: T }>): Promise<ActionResult<T>> {
  try {
    const { message, data } = await fn()
    return { ok: true, message, data }
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message }
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? 'Revise los datos del formulario.' }
    console.error('[action]', e)
    return { ok: false, error: 'No se ha podido guardar. Compruebe la conexión e inténtelo de nuevo; no se ha registrado nada a medias.' }
  }
}

export function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } }
  return err?.code === '23505' || err?.cause?.code === '23505'
}
