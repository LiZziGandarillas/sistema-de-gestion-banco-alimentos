export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'Europe/Madrid'

export const CATEGORIES = [
  'Arroz, pasta y legumbres',
  'Conservas',
  'Leche y lácteos',
  'Aceite',
  'Frutas y verduras',
  'Pan y cereales',
  'Higiene y limpieza',
  'Bebé',
  'Otros',
] as const

export const UNITS = ['unidades', 'paquetes', 'latas', 'kg', 'litros', 'botellas', 'cajas'] as const

const DAY_MS = 86_400_000

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function toUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  return new Date(toUTC(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((toUTC(toISO) - toUTC(fromISO)) / DAY_MS)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(toUTC(iso)).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  })
}

export function formatQty(value: number): string {
  return Number(value).toLocaleString('es-ES', { maximumFractionDigits: 2 })
}

export type PeriodSettings = { periodDays: number; periodStart: string }

/** Rotating distribution periods: fixed-length windows counted from the configured start date. */
export function currentPeriod(s: PeriodSettings, today = todayISO()) {
  const elapsed = Math.max(0, daysBetween(s.periodStart, today))
  const index = Math.floor(elapsed / s.periodDays)
  const start = addDays(s.periodStart, index * s.periodDays)
  const end = addDays(start, s.periodDays - 1)
  return { start, end, daysLeft: daysBetween(today, end) + 1 }
}

export type AlertSettings = { soonDays: number; urgentDays: number; reviewDays: number }

export type LotForAlert = {
  status: string
  quantityAvailable: number
  expiresAt: string | null
  expiryUnknown: boolean
  lastReviewedAt: string | null
  receivedAt: string
}

export type LotAlert =
  | { kind: 'vencido'; label: 'Vencido: revisar'; days: number }
  | { kind: 'urgente'; label: 'Distribuir primero'; days: number }
  | { kind: 'pronto'; label: 'Caduca pronto'; days: number }
  | { kind: 'revisar'; label: 'Revisar producto'; days: number }
  | { kind: 'ok'; label: 'En buen estado'; days: number | null }
  | { kind: 'cerrado'; label: 'Sin existencias'; days: null }

/**
 * Classifies a lot for display and for delivery eligibility.
 * An expired lot is only allowed again after a person reviews it on or after the expiry date
 * (e.g. "consumo preferente" products that are still fit for consumption).
 */
export function lotAlert(lot: LotForAlert, s: AlertSettings, today = todayISO()): LotAlert {
  if (lot.status !== 'disponible' || lot.quantityAvailable <= 0) {
    return { kind: 'cerrado', label: 'Sin existencias', days: null }
  }
  if (lot.expiryUnknown || !lot.expiresAt) {
    const base = lot.lastReviewedAt ?? lot.receivedAt
    const sinceReview = daysBetween(base, today)
    if (sinceReview >= s.reviewDays) return { kind: 'revisar', label: 'Revisar producto', days: sinceReview }
    return { kind: 'ok', label: 'En buen estado', days: null }
  }
  const days = daysBetween(today, lot.expiresAt)
  if (days < 0) {
    const reviewedAfterExpiry = lot.lastReviewedAt && lot.lastReviewedAt >= lot.expiresAt
    if (!reviewedAfterExpiry) return { kind: 'vencido', label: 'Vencido: revisar', days }
    const sinceReview = daysBetween(lot.lastReviewedAt!, today)
    if (sinceReview >= Math.min(7, s.reviewDays)) return { kind: 'revisar', label: 'Revisar producto', days: sinceReview }
    return { kind: 'urgente', label: 'Distribuir primero', days }
  }
  if (days <= s.urgentDays) return { kind: 'urgente', label: 'Distribuir primero', days }
  if (days <= s.soonDays) return { kind: 'pronto', label: 'Caduca pronto', days }
  return { kind: 'ok', label: 'En buen estado', days }
}

export function canDeliver(alert: LotAlert) {
  return alert.kind === 'urgente' || alert.kind === 'pronto' || alert.kind === 'ok'
}

/** FEFO: lots with the nearest expiry first; lots without a known date go last. */
export function fefoCompare(a: { expiresAt: string | null; receivedAt: string }, b: { expiresAt: string | null; receivedAt: string }) {
  if (a.expiresAt && b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt) || a.receivedAt.localeCompare(b.receivedAt)
  if (a.expiresAt) return -1
  if (b.expiresAt) return 1
  return a.receivedAt.localeCompare(b.receivedAt)
}

/** Orientation only: volunteers decide final quantities based on what is available. */
export function householdGuide(members: number) {
  if (members <= 2) return { label: 'Lote básico', factor: 1 }
  if (members <= 4) return { label: 'Lote mediano (1,5 veces el básico)', factor: 1.5 }
  return { label: 'Lote grande (2 veces el básico)', factor: 2 }
}
