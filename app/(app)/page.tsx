import Link from 'next/link'
import { Boxes, HandHeart, PackagePlus, Users } from 'lucide-react'
import { getRecentDeliveries, getSummary } from '@/lib/queries'
import { requireVolunteerPage } from '@/lib/session'
import { formatDate, formatDateTime, formatQty } from '@/lib/domain'
import { AlertLabel, EmptyState, Panel, expiryText } from '@/components/kit'

export default async function HomePage() {
  const v = await requireVolunteerPage()
  const [summary, recent] = await Promise.all([getSummary(), getRecentDeliveries(6)])
  const { period } = summary

  const tasks = [
    { href: '/donaciones/nueva', label: 'Registrar donación', hint: 'Llegan productos', Icon: PackagePlus },
    { href: '/entregas/nueva', label: 'Registrar entrega', hint: 'Una familia recoge', Icon: HandHeart },
    { href: '/inventario', label: 'Ver inventario', hint: 'Qué hay y qué caduca', Icon: Boxes },
    { href: '/familias', label: 'Buscar familia', hint: 'Por código o referencia', Icon: Users },
  ]

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-lg text-muted-foreground">
          {'Hola, '}
          {v.name.split(' ')[0]}
        </p>
        <h1 className="text-balance text-3xl font-bold md:text-4xl">¿Qué va a hacer ahora?</h1>
        <p className="text-lg">
          {'Periodo de reparto: '}
          <strong>
            {formatDate(period.start)}
            {' al '}
            {formatDate(period.end)}
          </strong>
          {` · quedan ${period.daysLeft} ${period.daysLeft === 1 ? 'día' : 'días'}`}
        </p>
      </header>

      <nav aria-label="Tareas principales" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tasks.map(({ href, label, hint, Icon }, i) => (
          <Link
            key={href}
            href={href}
            className={
              i < 2
                ? 'flex items-center gap-4 rounded-xl bg-primary p-5 text-primary-foreground hover:bg-primary/90 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring'
                : 'flex items-center gap-4 rounded-xl border-2 border-border bg-card p-5 hover:border-primary focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring'
            }
          >
            <Icon className="size-9 shrink-0" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-xl font-bold">{label}</span>
              <span className={i < 2 ? 'text-base text-primary-foreground' : 'text-base text-muted-foreground'}>{hint}</span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Panel title="Necesita atención" className="lg:col-span-3">
          {summary.attention.length === 0 ? (
            <EmptyState title="Todo en orden">
              <p className="text-lg text-muted-foreground">No hay productos vencidos, urgentes ni pendientes de revisar.</p>
            </EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {summary.attention.map((lot) => (
                <li key={lot.id}>
                  <Link href={`/inventario/${lot.id}`} className="flex flex-col gap-1 py-3 hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex flex-col">
                      <span className="text-lg font-bold">{lot.name}</span>
                      <span className="text-base text-muted-foreground">
                        {`${lot.code} · ${formatQty(lot.quantityAvailable)} ${lot.unit} · ${expiryText(lot.alert, lot.expiresAt)}`}
                      </span>
                    </span>
                    <AlertLabel alert={lot.alert} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/inventario" className="inline-flex min-h-12 w-fit items-center py-2 text-base font-bold text-primary underline underline-offset-4">
            Ver todo el inventario
          </Link>
        </Panel>

        <Panel title="Este periodo" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-4">
            <Stat label="Familias atendidas" value={`${summary.families.served} de ${summary.families.active}`} />
            <Stat label="Entregas" value={summary.deliveries.total} />
            <Stat label="Caducan pronto" value={summary.lots.urgente + summary.lots.pronto} />
            <Stat label="Por revisar" value={summary.lots.vencido + summary.lots.revisar} />
          </dl>
        </Panel>
      </div>

      <Panel title="Últimas entregas">
        {recent.length === 0 ? (
          <p className="text-lg text-muted-foreground">Todavía no hay entregas registradas.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {recent.map((d) => (
              <li key={d.id}>
                <Link href={`/entregas/${d.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-muted/60">
                  <span className="text-lg">
                    <strong>{d.familyCode}</strong>
                    {` · ${formatDateTime(d.deliveredAt)} · ${d.by ?? ''}`}
                  </span>
                  <span className="flex flex-wrap gap-2 text-base font-bold">
                    {d.isException ? <span className="rounded-md bg-warning px-2 py-1 text-warning-foreground">Excepción</span> : null}
                    {d.status === 'anulada' ? <span className="rounded-md bg-destructive px-2 py-1 text-white">Anulada</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted p-4">
      <dt className="text-base text-muted-foreground">{label}</dt>
      <dd className="text-3xl font-bold">{value}</dd>
    </div>
  )
}
