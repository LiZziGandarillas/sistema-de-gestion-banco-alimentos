import 'server-only'
import { and, asc, desc, eq, gt, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deliveries, deliveryItems, families, lots, movements, user, volunteers } from '@/lib/db/schema'
import { getSettings } from '@/lib/session'
import { currentPeriod, fefoCompare, lotAlert, todayISO } from '@/lib/domain'

export type LotRow = typeof lots.$inferSelect

export async function getAvailableLots() {
  const s = await getSettings()
  const rows = await db
    .select()
    .from(lots)
    .where(and(eq(lots.status, 'disponible'), gt(lots.quantityAvailable, 0)))
  const today = todayISO()
  return rows.sort(fefoCompare).map((lot) => ({ ...lot, alert: lotAlert(lot, s, today) }))
}

export async function getClosedLots(limit = 100) {
  return db
    .select()
    .from(lots)
    .where(or(sql`${lots.status} <> 'disponible'`, eq(lots.quantityAvailable, 0)))
    .orderBy(desc(lots.createdAt))
    .limit(limit)
}

export async function getLot(id: number) {
  const s = await getSettings()
  const [lot] = await db.select().from(lots).where(eq(lots.id, id))
  if (!lot) return null
  const history = await db
    .select({
      id: movements.id,
      type: movements.type,
      quantity: movements.quantity,
      reason: movements.reason,
      deliveryId: movements.deliveryId,
      createdAt: movements.createdAt,
      by: user.name,
    })
    .from(movements)
    .leftJoin(user, eq(user.id, movements.createdBy))
    .where(eq(movements.lotId, id))
    .orderBy(desc(movements.createdAt), desc(movements.id))
  return { lot, alert: lotAlert(lot, s), history }
}

export async function getFamiliesWithStatus(query?: string) {
  const s = await getSettings()
  const period = currentPeriod(s)
  const q = query?.trim()
  const rows = await db
    .select({
      id: families.id,
      code: families.code,
      reference: families.reference,
      members: families.members,
      status: families.status,
      lastDeliveryAt: sql<Date | null>`(SELECT max(d."deliveredAt") FROM deliveries d WHERE d."familyId" = ${families.id} AND d.status = 'registrada')`,
      deliveredThisPeriod: sql<boolean>`EXISTS (SELECT 1 FROM deliveries d WHERE d."familyId" = ${families.id} AND d.status = 'registrada' AND d."periodStart" = ${period.start})`,
    })
    .from(families)
    .where(q ? or(ilike(families.code, `%${q}%`), ilike(families.reference, `%${q}%`)) : undefined)
    .orderBy(asc(families.code))
    .limit(300)
  return { period, rows }
}

export async function getFamily(id: number) {
  const s = await getSettings()
  const period = currentPeriod(s)
  const [family] = await db.select().from(families).where(eq(families.id, id))
  if (!family) return null
  const history = await db
    .select({
      id: deliveries.id,
      deliveredAt: deliveries.deliveredAt,
      periodStart: deliveries.periodStart,
      status: deliveries.status,
      isException: deliveries.isException,
      by: user.name,
      lines: sql<number>`(SELECT count(*)::int FROM delivery_items i WHERE i."deliveryId" = ${deliveries.id})`,
    })
    .from(deliveries)
    .leftJoin(user, eq(user.id, deliveries.createdBy))
    .where(eq(deliveries.familyId, id))
    .orderBy(desc(deliveries.deliveredAt))
    .limit(50)
  const deliveredThisPeriod = history.find((d) => d.status === 'registrada' && d.periodStart === period.start)
  return { family, history, period, deliveredThisPeriod }
}

export async function getDelivery(id: number) {
  const [delivery] = await db
    .select({
      id: deliveries.id,
      deliveredAt: deliveries.deliveredAt,
      periodStart: deliveries.periodStart,
      status: deliveries.status,
      isException: deliveries.isException,
      exceptionReason: deliveries.exceptionReason,
      voidReason: deliveries.voidReason,
      notes: deliveries.notes,
      familyId: families.id,
      familyCode: families.code,
      familyReference: families.reference,
      by: user.name,
    })
    .from(deliveries)
    .innerJoin(families, eq(families.id, deliveries.familyId))
    .leftJoin(user, eq(user.id, deliveries.createdBy))
    .where(eq(deliveries.id, id))
  if (!delivery) return null
  const items = await db
    .select({
      id: deliveryItems.id,
      quantity: deliveryItems.quantity,
      originalQuantity: deliveryItems.originalQuantity,
      lotId: lots.id,
      lotCode: lots.code,
      name: lots.name,
      unit: lots.unit,
    })
    .from(deliveryItems)
    .innerJoin(lots, eq(lots.id, deliveryItems.lotId))
    .where(eq(deliveryItems.deliveryId, id))
    .orderBy(asc(deliveryItems.id))
  const corrections = await db
    .select({ id: movements.id, type: movements.type, reason: movements.reason, createdAt: movements.createdAt, by: user.name })
    .from(movements)
    .leftJoin(user, eq(user.id, movements.createdBy))
    .where(and(eq(movements.deliveryId, id), sql`${movements.type} IN ('correccion','anulacion')`))
    .orderBy(desc(movements.createdAt))
  return { delivery, items, corrections }
}

export async function getRecentDeliveries(limit = 15) {
  return db
    .select({
      id: deliveries.id,
      deliveredAt: deliveries.deliveredAt,
      status: deliveries.status,
      isException: deliveries.isException,
      familyCode: families.code,
      familyReference: families.reference,
      by: user.name,
    })
    .from(deliveries)
    .innerJoin(families, eq(families.id, deliveries.familyId))
    .leftJoin(user, eq(user.id, deliveries.createdBy))
    .orderBy(desc(deliveries.deliveredAt))
    .limit(limit)
}

export async function getSummary() {
  const s = await getSettings()
  const period = currentPeriod(s)
  const available = await getAvailableLots()
  const count = (kind: string) => available.filter((l) => l.alert.kind === kind).length

  const [fam] = await db
    .select({
      active: sql<number>`count(*) FILTER (WHERE ${families.status} = 'activa')::int`,
      served: sql<number>`count(*) FILTER (WHERE ${families.status} = 'activa' AND EXISTS (SELECT 1 FROM deliveries d WHERE d."familyId" = ${families.id} AND d.status = 'registrada' AND d."periodStart" = ${period.start}))::int`,
    })
    .from(families)

  const [dels] = await db
    .select({
      total: sql<number>`count(*) FILTER (WHERE ${deliveries.status} = 'registrada')::int`,
      exceptions: sql<number>`count(*) FILTER (WHERE ${deliveries.status} = 'registrada' AND ${deliveries.isException})::int`,
      voided: sql<number>`count(*) FILTER (WHERE ${deliveries.status} = 'anulada')::int`,
    })
    .from(deliveries)
    .where(eq(deliveries.periodStart, period.start))

  const [waste] = await db
    .select({ lots: sql<number>`count(DISTINCT ${movements.lotId})::int` })
    .from(movements)
    .where(and(eq(movements.type, 'descarte'), sql`${movements.createdAt}::date >= ${period.start}::date`))

  const byCategory = Object.entries(
    available.reduce<Record<string, number>>((acc, l) => {
      acc[l.category] = (acc[l.category] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  return {
    period,
    settings: s,
    lots: {
      total: available.length,
      vencido: count('vencido'),
      urgente: count('urgente'),
      pronto: count('pronto'),
      revisar: count('revisar'),
    },
    attention: available.filter((l) => ['vencido', 'urgente', 'revisar'].includes(l.alert.kind)).slice(0, 6),
    families: { active: fam.active, served: fam.served, pending: fam.active - fam.served },
    deliveries: dels,
    discardedLots: waste.lots,
    byCategory,
  }
}

export async function getVolunteerList() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      role: volunteers.role,
      active: volunteers.active,
    })
    .from(user)
    .leftJoin(volunteers, eq(volunteers.userId, user.id))
    .orderBy(asc(user.createdAt))
}
