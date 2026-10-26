import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'
import { getCurrentVolunteer } from '@/lib/session'
import { SignOutButton } from '@/components/sign-out-button'

export default async function PendingPage() {
  const v = await getCurrentVolunteer()
  if (!v) redirect('/sign-in')
  if (v.active) redirect('/')
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-6 md:p-8">
        <span className="flex size-12 items-center justify-center rounded-xl bg-warning text-warning-foreground" aria-hidden="true">
          <Clock className="size-7" />
        </span>
        <h1 className="text-3xl font-bold">Cuenta pendiente de activar</h1>
        <p className="text-lg">
          {'Hola, '}
          {v.name}
          {'. Su cuenta está creada, pero la persona coordinadora tiene que activarla antes de que pueda registrar donaciones o entregas.'}
        </p>
        <p className="text-lg text-muted-foreground">Avise a la coordinación y vuelva a entrar cuando se lo confirmen.</p>
        <SignOutButton />
      </div>
    </main>
  )
}
