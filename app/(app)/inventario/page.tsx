import Link from 'next/link'
import { PackagePlus } from 'lucide-react'
import { getAvailableLots, getClosedLots } from '@/lib/queries'
import { formatDate, formatQty } from '@/lib/domain'
import { AlertLabel, EmptyState, LinkButton, PageHeader, expiryText } from '@/components/kit'
import { cn } from '@/lib/utils'

const filters = [
  { key: 'todos', label: 'Todos' },
  { key: 'atencion', label: 'Necesitan atención' },
  { key: 'cerrados', label: 'Agotados y retirados' },
] as const

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ ver?: string; categoria?: string }> }) {
  const { ver = 'todos', categoria } = await searchParams

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Ordenado por caducidad: lo de arriba se entrega primero."
        actions={
          <LinkButton href="/donaciones/nueva">
            <PackagePlus aria-hidden="true" />
            Registrar donación
          </LinkButton>
        }
      />
      <nav aria-label="Filtros" className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/inventario?ver=${f.key}`}
            aria-current={ver === f.key ? 'page' : undefined}
            className={cn(
              'flex h-12 items-center rounded-lg border-2 px-4 text-base font-bold',
              ver === f.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary',
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {ver === 'cerrados' ? <ClosedList /> : <OpenList onlyAttention={ver === 'atencion'} category={categoria} />}
    </>
  )
}

async function OpenList({ onlyAttention, category }: { onlyAttention: boolean; category?: string }) {
  let lots = await getAvailableLots()
  if (onlyAttention) lots = lots.filter((l) => ['vencido', 'urgente', 'revisar', 'pronto'].includes(l.alert.kind))
  if (category) lots = lots.filter((l) => l.category === category)

  if (lots.length === 0) {
    return (
      <EmptyState title={onlyAttention ? 'Nada requiere atención ahora' : 'No hay productos disponibles'}>
        <p className="text-lg text-muted-foreground">Cuando registre una donación, aparecerá aquí.</p>
      </EmptyState>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-left">
        <caption className="sr-only">Productos disponibles ordenados por fecha de caducidad</caption>
        <thead className="hidden bg-muted text-base md:table-header-group">
          <tr>
            <th scope="col" className="px-4 py-3">Producto</th>
            <th scope="col" className="px-4 py-3">Queda</th>
            <th scope="col" className="px-4 py-3">Caducidad</th>
            <th scope="col" className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lots.map((lot) => (
            <tr key={lot.id} className="flex flex-col gap-1 p-4 hover:bg-muted/50 md:table-row md:p-0">
              <td className="md:px-4 md:py-3">
                <Link href={`/inventario/${lot.id}`} className="flex flex-col after:absolute">
                  <span className="text-lg font-bold underline-offset-4 hover:underline">{lot.name}</span>
                  <span className="text-base text-muted-foreground">{`${lot.code} · ${lot.category}`}</span>
                </Link>
              </td>
              <td className="flex items-baseline gap-2 text-lg md:table-cell md:px-4 md:py-3">
                <span className="text-base font-bold md:hidden">Queda:</span>
                <strong>{formatQty(lot.quantityAvailable)}</strong>
                {` ${lot.unit}`}
              </td>
              <td className="flex items-baseline gap-2 text-base md:table-cell md:px-4 md:py-3">
                <span className="text-base font-bold md:hidden">Caducidad:</span>
                <span className="flex flex-col">
                  <span>{lot.expiresAt ? formatDate(lot.expiresAt) : 'Sin fecha'}</span>
                  <span className="text-muted-foreground">{expiryText(lot.alert, lot.expiresAt)}</span>
                </span>
              </td>
              <td className="flex items-baseline gap-2 md:table-cell md:px-4 md:py-3">
                <span className="text-base font-bold md:hidden">Estado:</span>
                <AlertLabel alert={lot.alert} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const statusText: Record<string, string> = {
  disponible: 'Agotado',
  distribuido: 'Entregado por completo',
  descartado: 'Retirado',
  vencido: 'Vencido y retirado',
  reservado: 'Reservado',
}

async function ClosedList() {
  const lots = await getClosedLots()
  if (lots.length === 0) return <EmptyState title="Todavía no hay lotes cerrados" />
  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
      {lots.map((lot) => (
        <li key={lot.id}>
          <Link href={`/inventario/${lot.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-muted/50">
            <span className="flex flex-col">
              <span className="text-lg font-bold">{lot.name}</span>
              <span className="text-base text-muted-foreground">{`${lot.code} · recibido ${formatDate(lot.receivedAt)}`}</span>
            </span>
            <span className="rounded-md bg-muted px-2.5 py-1 text-base font-bold">{statusText[lot.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
