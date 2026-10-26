import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const volunteers = pgTable('volunteers', {
  userId: text('userId').primaryKey(),
  role: text('role').$type<'coordinador' | 'voluntario'>().notNull().default('voluntario'),
  active: boolean('active').notNull().default(false),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  periodDays: integer('periodDays').notNull().default(14),
  periodStart: date('periodStart', { mode: 'string' }).notNull(),
  soonDays: integer('soonDays').notNull().default(7),
  urgentDays: integer('urgentDays').notNull().default(3),
  reviewDays: integer('reviewDays').notNull().default(30),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  updatedBy: text('updatedBy'),
})

export type LotStatus = 'disponible' | 'reservado' | 'distribuido' | 'vencido' | 'descartado'

export const lots = pgTable('lots', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  unit: text('unit').notNull(),
  quantityReceived: numeric('quantityReceived', { mode: 'number' }).notNull(),
  quantityAvailable: numeric('quantityAvailable', { mode: 'number' }).notNull(),
  receivedAt: date('receivedAt', { mode: 'string' }).notNull(),
  expiresAt: date('expiresAt', { mode: 'string' }),
  expiryUnknown: boolean('expiryUnknown').notNull().default(false),
  lastReviewedAt: date('lastReviewedAt', { mode: 'string' }),
  status: text('status').$type<LotStatus>().notNull().default('disponible'),
  notes: text('notes'),
  idempotencyKey: text('idempotencyKey').unique(),
  createdBy: text('createdBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const families = pgTable('families', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  reference: text('reference').notNull(),
  members: integer('members').notNull(),
  status: text('status').$type<'activa' | 'inactiva'>().notNull().default('activa'),
  notes: text('notes'),
  createdBy: text('createdBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const deliveries = pgTable('deliveries', {
  id: serial('id').primaryKey(),
  familyId: integer('familyId')
    .notNull()
    .references(() => families.id),
  deliveredAt: timestamp('deliveredAt').notNull().defaultNow(),
  periodStart: date('periodStart', { mode: 'string' }).notNull(),
  isException: boolean('isException').notNull().default(false),
  exceptionReason: text('exceptionReason'),
  status: text('status').$type<'registrada' | 'anulada'>().notNull().default('registrada'),
  voidReason: text('voidReason'),
  voidedBy: text('voidedBy'),
  voidedAt: timestamp('voidedAt'),
  notes: text('notes'),
  idempotencyKey: text('idempotencyKey').notNull().unique(),
  createdBy: text('createdBy').notNull(),
})

export const deliveryItems = pgTable('delivery_items', {
  id: serial('id').primaryKey(),
  deliveryId: integer('deliveryId')
    .notNull()
    .references(() => deliveries.id),
  lotId: integer('lotId')
    .notNull()
    .references(() => lots.id),
  quantity: numeric('quantity', { mode: 'number' }).notNull(),
  originalQuantity: numeric('originalQuantity', { mode: 'number' }).notNull(),
})

export type MovementType = 'entrada' | 'entrega' | 'descarte' | 'ajuste' | 'correccion' | 'anulacion'

export const movements = pgTable('movements', {
  id: serial('id').primaryKey(),
  lotId: integer('lotId')
    .notNull()
    .references(() => lots.id),
  type: text('type').$type<MovementType>().notNull(),
  quantity: numeric('quantity', { mode: 'number' }).notNull(),
  deliveryId: integer('deliveryId').references(() => deliveries.id),
  reason: text('reason'),
  createdBy: text('createdBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})
