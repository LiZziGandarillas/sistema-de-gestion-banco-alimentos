import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock, Search, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import type { LotAlert } from '@/lib/domain'

export const fieldClass =
  'h-12 w-full rounded-lg border-2 border-input bg-card px-3 text-lg text-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25 disabled:opacity-60'

export const bigButton = 'h-12 px-5 text-lg font-bold rounded-lg gap-2 [&_svg:not([class*=size-])]:size-5'

export function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string
  htmlFor: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-base font-bold">
        {label}
      </label>
      {children}
      {help ? (
        <p id={`${htmlFor}-help`} className="text-base text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: string
  description?: string
  back?: { href: string; label: string }
  actions?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 pb-6">
      {back ? (
        <Link href={back.href} className="inline-flex min-h-12 w-fit items-center py-2 text-base font-bold text-primary underline underline-offset-4">
          {'← '}
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-balance text-3xl font-bold md:text-4xl">{title}</h1>
          {description ? <p className="max-w-2xl text-pretty text-lg text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </header>
  )
}

export function LinkButton({
  href,
  children,
  variant = 'default',
  className,
}: {
  href: string
  children: React.ReactNode
  variant?: 'default' | 'outline' | 'secondary'
  className?: string
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant }), bigButton, className)}>
      {children}
    </Link>
  )
}

const alertStyles: Record<LotAlert['kind'], { className: string; Icon: typeof Clock }> = {
  vencido: { className: 'bg-destructive text-white', Icon: XCircle },
  urgente: { className: 'bg-warning text-warning-foreground', Icon: AlertTriangle },
  pronto: { className: 'bg-secondary text-secondary-foreground border-2 border-primary/30', Icon: Clock },
  revisar: { className: 'bg-foreground text-background', Icon: Search },
  ok: { className: 'bg-muted text-muted-foreground', Icon: CheckCircle2 },
  cerrado: { className: 'bg-muted text-muted-foreground', Icon: CheckCircle2 },
}

export function AlertLabel({ alert }: { alert: LotAlert }) {
  const { className, Icon } = alertStyles[alert.kind]
  return (
    <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-base font-bold', className)}>
      <Icon className="size-4" aria-hidden="true" />
      {alert.label}
    </span>
  )
}

export function expiryText(alert: LotAlert, expiresAt: string | null) {
  if (!expiresAt) return 'Sin fecha visible'
  if (alert.days === null) return ''
  if (alert.days < 0) return `Venció hace ${-alert.days} ${-alert.days === 1 ? 'día' : 'días'}`
  if (alert.days === 0) return 'Caduca hoy'
  if (alert.days === 1) return 'Caduca mañana'
  return `Caduca en ${alert.days} días`
}

export function ResultBanner({ result }: { result: { ok: true; message: string } | { ok: false; error: string } | null }) {
  if (!result) return null
  return (
    <div
      role={result.ok ? 'status' : 'alert'}
      className={cn(
        'flex items-start gap-3 rounded-lg border-2 p-4 text-lg',
        result.ok ? 'border-primary bg-secondary text-secondary-foreground' : 'border-destructive bg-card text-destructive',
      )}
    >
      {result.ok ? (
        <CheckCircle2 className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
      )}
      <p className="font-bold">{result.ok ? result.message : result.error}</p>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border-2 border-dashed border-border bg-card p-6">
      <p className="text-xl font-bold">{title}</p>
      {children}
    </div>
  )
}

export function Panel({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-xl border border-border bg-card p-5 md:p-6', className)}>
      {title ? <h2 className="text-2xl font-bold">{title}</h2> : null}
      {children}
    </section>
  )
}
