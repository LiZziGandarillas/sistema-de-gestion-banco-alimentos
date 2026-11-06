'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { HandHeart } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Field, ResultBanner, bigButton, fieldClass } from '@/components/kit'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSignUp = mode === 'sign-up'

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const name = String(form.get('name') ?? '').trim()

    const { error } = isSignUp
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password })

    if (error) {
      console.error('[auth]', error)
      setError(
        isSignUp
          ? 'No se ha podido crear la cuenta. Revise los datos o pruebe con otro correo.'
          : 'El correo o la contraseña no son correctos.',
      )
      setPending(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex flex-col gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden="true">
            <HandHeart className="size-7" />
          </span>
          <h1 className="text-3xl font-bold">{isSignUp ? 'Crear cuenta de voluntariado' : 'Entrar'}</h1>
          <p className="text-lg text-muted-foreground">
            {isSignUp
              ? 'Después de crearla, la persona coordinadora tiene que activarla.'
              : 'Banco de Alimentos del barrio. Use su correo y contraseña.'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {isSignUp ? (
            <Field label="Nombre" htmlFor="name">
              <input id="name" name="name" required autoComplete="name" className={fieldClass} />
            </Field>
          ) : null}
          <Field label="Correo electrónico" htmlFor="email">
            <input id="email" name="email" type="email" required autoComplete="email" className={fieldClass} />
          </Field>
          <Field
            label="Contraseña"
            htmlFor="password"
            help={isSignUp ? 'Al menos 8 caracteres. No la comparta con nadie.' : undefined}
          >
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className={fieldClass}
            />
          </Field>
          {!isSignUp ? (
            <Link href="/recuperar" className="inline-flex min-h-12 w-fit items-center py-2 text-base font-bold text-primary underline underline-offset-4">
              ¿Olvidaste tu contraseña?
            </Link>
          ) : null}
          <ResultBanner result={error ? { ok: false, error } : null} />
          <Button type="submit" disabled={pending} className={bigButton}>
            {pending ? 'Un momento…' : isSignUp ? 'Crear cuenta' : 'Entrar'}
          </Button>
        </form>

        <p className="text-base">
          {isSignUp ? '¿Ya tiene cuenta? ' : '¿Primera vez? '}
          <Link href={isSignUp ? '/sign-in' : '/sign-up'} className="inline-flex min-h-12 items-center py-2 font-bold text-primary underline underline-offset-4">
            {isSignUp ? 'Entrar' : 'Crear una cuenta'}
          </Link>
        </p>
      </div>
    </main>
  )
}
