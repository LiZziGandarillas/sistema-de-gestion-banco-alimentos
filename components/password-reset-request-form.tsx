'use client'

import Link from 'next/link'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Field, PageHeader, ResultBanner, bigButton, fieldClass } from '@/components/kit'

export function PasswordResetRequestForm() {
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ ok: true; message: string } | { ok: false; error: string } | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setResult(null)

    const form = event.currentTarget
    const email = String(new FormData(form).get('email') ?? '').trim()
    const redirectTo = new URL('/restablecer', window.location.origin).toString()

    try {
      const { error } = await authClient.requestPasswordReset({ email, redirectTo })

      if (error) {
        setResult({ ok: false, error: 'No se pudo procesar la solicitud. Inténtalo de nuevo.' })
        return
      }

      setResult({
        ok: true,
        message: 'Si existe una cuenta con ese correo, recibirás instrucciones para restablecer tu contraseña',
      })
      form.reset()
    } catch {
      setResult({ ok: false, error: 'No se pudo procesar la solicitud. Comprueba tu conexión e inténtalo de nuevo.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <section className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-6 md:p-8">
        <PageHeader
          title="Recuperar contraseña"
          description="Escribe el correo asociado a tu cuenta. Te enviaremos instrucciones si existe una cuenta con esa dirección."
          back={{ href: '/sign-in', label: 'Volver al inicio de sesión' }}
        />
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field label="Correo electrónico" htmlFor="reset-email">
            <input
              id="reset-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={fieldClass}
              disabled={pending}
            />
          </Field>
          <ResultBanner result={result} />
          {result?.ok ? null : (
            <Button type="submit" disabled={pending} className={bigButton}>
              {pending ? 'Enviando…' : 'Enviar instrucciones'}
            </Button>
          )}
        </form>
        <p className="text-base">
          <Link href="/sign-in" className="inline-flex min-h-12 items-center py-2 font-bold text-primary underline underline-offset-4">
            Volver al inicio de sesión
          </Link>
        </p>
      </section>
    </main>
  )
}
