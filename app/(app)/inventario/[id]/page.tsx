import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLot } from '@/lib/queries'
import { formatDate, formatDateTime, formatQty } from '@/lib/domain'
import { AlertLabel, PageHeader, Panel, expiryText } from '@/components/kit'
import { LotActions } from '@/components/lot-actions'

const movementLabel: Record<string, string> = {
  entrada: 'Entrada',
  entrega: 'Entrega',
  descarte: 'Descarte',
  ajuste: 'Ajuste',
  correccion: 'Corrección',
  anulacion: 'Anulación',
}

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getLot(Number(id))
  if (!data) notFound()
  const { lot, alert, history } = data

  return (
    <>
      <PageHeader title={lot.name} description={`Lote ${lot.code} · ${lot.category}`} back={{ href: '/inventario', label: 'Inventario' }} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <AlertLabel alert={alert} />
          <dl className="flex flex-col gap-3 text-lg">
            <Row label="Queda" value={`${formatQty(lot.quantityAvailable)} de ${formatQty(lot.quantityReceived)} ${lot.unit}`} />
            <Row label="Caducidad" value={lot.expiresAt ? `${formatDate(lot.expiresAt)} (${expiryText(alert, lot.expiresAt)})` : 'Sin fecha visible'} />
            <Row label="Recibido" value={formatDate(lot.receivedAt)} />
            <Row label="Última revisión" value={formatDate(lot.lastReviewedAt)} />
          </dl>
          {lot.notes ? <p className="whitespace-pre-line rounded-lg bg-muted p-3 text-base">{lot.notes}</p> : null}
          {alert.kind !== 'cerrado' ? <LotActions lotId={lot.id} unit={lot.unit} available={lot.quantityAvailable} alertKind={alert.kind} /> : null}
        </Panel>

        <Panel title="Historial del lote" className="lg:col-span-2">
          <ol className="flex flex-col divide-y divide-border">
            {history.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
                <span className="flex flex-col">
                  <span className="text-lg font-bold">
                    {movementLabel[m.type]}
                    {m.deliveryId ? (
                      <Link href={`/entregas/${m.deliveryId}`} className="ml-2 inline-flex min-h-12 items-center text-base font-normal text-primary underline underline-offset-4">
                        ver entrega
                      </Link>
                    ) : null}
                  </span>
                  <span className="text-base text-muted-foreground">{`${formatDateTime(m.createdAt)} · ${m.by ?? '—'}`}</span>
                  {m.reason ? <span className="text-base">{m.reason}</span> : null}
                </span>
                <span className={m.quantity < 0 ? 'text-lg font-bold text-destructive' : 'text-lg font-bold text-primary'}>
                  {`${m.quantity > 0 ? '+' : ''}${formatQty(m.quantity)} ${lot.unit}`}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-base text-muted-foreground">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  )
}
