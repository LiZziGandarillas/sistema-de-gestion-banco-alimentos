'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Field, PageHeader, ResultBanner, bigButton, fieldClass } from '@/components/kit'

type FormResult = { ok: true; message: string } | { ok: false; error: string }

export function PasswordResetForm() {
  const [token, setToken] = useState<string | null>(null)
  const [tokenReady, setTokenReady] = useState(false)
  const [invalidLinkMessage, setInvalidLinkMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<FormResult | null>(null)
  const parametersProcessed = useRef(false)

  useEffect(() => {
    if (parametersProcessed.current) return
    parametersProcessed.current = true

    const params = new URLSearchParams(window.location.search)
    const resetToken = params.get('token')
    const resetError = params.get('error')

    window.history.replaceState(window.history.state, '', window.location.pathname)
    setToken(resetToken)
    if (!resetToken && resetError === 'INVALID_TOKEN') {
      setInvalidLinkMessage('El enlace es inválido, venció o ya fue utilizado. Solicita uno nuevo para restablecer tu contraseña.')
    }
    setTokenReady(true)
  }, [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const newPassword = String(formData.get('password') ?? '')
    const confirmation = String(formData.get('confirmation') ?? '')

    if (newPassword.length < 8 || newPassword.length > 128) {
      setResult({ ok: false, error: 'La contraseña debe tener entre 8 y 128 caracteres.' })
      return
    }
    if (newPassword !== confirmation) {
      setResult({ ok: false, error: 'Las contraseñas no coinciden. Revísalas e inténtalo de nuevo.' })
      return
    }

    setPending(true)
    setResult(null)

    try {
      const { error } = await authClient.resetPassword({ newPassword, token })

      if (error) {
        setResult({
          ok: false,
          error: 'El enlace no es válido o ha caducado. Solicita uno nuevo para cambiar tu contraseña.',
        })
        return
      }

      form.reset()
      setToken(null)
      setResult({ ok: true, message: 'Tu contraseña se cambió correctamente. Ya puedes iniciar sesión.' })
    } catch {
      setResult({
        ok: false,
        error: 'No se pudo cambiar la contraseña. Comprueba tu conexión e inténtalo de nuevo; si el enlace caducó, solicita uno nuevo.',
      })
    } finally {
      setPending(false)
    }
  }

  const hasToken = tokenReady && token !== null
  const success = result?.ok === true

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <section className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-6 md:p-8">
        <PageHeader
          title="Establecer contraseña nueva"
          description="Elige una contraseña nueva para tu cuenta."
          back={{ href: '/sign-in', label: 'Volver al inicio de sesión' }}
        />
        {!tokenReady ? <p role="status" className="text-base">Comprobando el enlace…</p> : null}
        {tokenReady && !hasToken && !success ? (
          <div className="flex flex-col gap-4">
            <ResultBanner
              result={{
                ok: false,
                error:
                  result && !result.ok
                    ? result.error
                    : invalidLinkMessage ??
                      'No encontramos un enlace válido. Solicita uno nuevo para restablecer tu contraseña.',
              }}
            />
            <Link href="/recuperar" className="inline-flex min-h-12 w-fit items-center py-2 text-base font-bold text-primary underline underline-offset-4">
              Solicitar otro enlace
            </Link>
          </div>
        ) : null}
        {hasToken && !success ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <Field label="Nueva contraseña" htmlFor="new-password" help="Debe tener entre 8 y 128 caracteres.">
              <input
                id="new-password"
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                aria-describedby="new-password-help"
                className={fieldClass}
                disabled={pending}
              />
            </Field>
            <Field label="Confirma la nueva contraseña" htmlFor="confirm-password">
              <input
                id="confirm-password"
                name="confirmation"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                className={fieldClass}
                disabled={pending}
              />
            </Field>
            <ResultBanner result={result && !result.ok ? result : null} />
            {result && !result.ok ? (
              <Link href="/recuperar" className="inline-flex min-h-12 w-fit items-center py-2 text-base font-bold text-primary underline underline-offset-4">
                Solicitar otro enlace
              </Link>
            ) : null}
            <Button type="submit" disabled={pending} className={bigButton}>
              {pending ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </form>
        ) : null}
        {success ? <ResultBanner result={result} /> : null}
        <p className="text-base">
          <Link href="/sign-in" className="inline-flex min-h-12 items-center py-2 font-bold text-primary underline underline-offset-4">
            Volver al inicio de sesión
          </Link>
        </p>
      </section>
    </main>
  )
}
