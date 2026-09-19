// Subset of docs/05_DATABASE_DESIGN.md needed for the web MVP so far.
// Constraints Drizzle can't express (triggers, exclusion constraint, CHECKs) live in db/migrations/*_rules.sql.
import { sql } from "drizzle-orm";
import { bigint, boolean, date, jsonb, numeric, pgSchema, smallint, text, timestamp, uniqueIndex, uuid, index } from "drizzle-orm/pg-core";

export const app = pgSchema("app");

const id = () => uuid("id").primaryKey().defaultRandom();
const money = (name: string) => bigint(name, { mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const day = (name: string) => date(name, { mode: "string" });

// Standard sync columns (05 §1.1). `version` is stamped by trigger app.stamp_version().
const sync = () => ({
  version: bigint("version", { mode: "number" }).notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  deletedAt: ts("deleted_at"),
});

export const profiles = app.table("profiles", {
  id: id(),
  fullName: text("full_name").notNull().default(""),
  email: text("email").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const workspaces = app.table("workspaces", {
  id: id(),
  name: text("name").notNull(),
  countryCode: text("country_code").notNull(),
  defaultCurrency: text("default_currency").notNull(),
  timeZone: text("time_zone").notNull(),
  roundToWholeUnits: boolean("round_to_whole_units").notNull().default(true),
  receiptPrefix: text("receipt_prefix").notNull().default("R-"),
  paymentInstructions: jsonb("payment_instructions"),
  ...sync(),
});

export const workspaceCounters = app.table("workspace_counters", {
  workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  changeSeq: bigint("change_seq", { mode: "number" }).notNull().default(0),
  receiptSeq: bigint("receipt_seq", { mode: "number" }).notNull().default(0),
  purgeFloor: bigint("purge_floor", { mode: "number" }).notNull().default(0),
});

export const memberships = app.table("memberships", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  userId: uuid("user_id").references(() => profiles.id),
  role: text("role").notNull(),
  allProperties: boolean("all_properties").notNull().default(true),
  status: text("status").notNull().default("INVITED"),
  email: text("email").notNull(),
  displayName: text("display_name"),
  ...sync(),
});

export const properties = app.table("properties", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  region: text("region"),
  postalCode: text("postal_code"),
  countryCode: text("country_code").notNull(),
  currency: text("currency").notNull(),
  notes: text("notes"),
  archivedAt: ts("archived_at"),
  ...sync(),
}, (t) => [
  uniqueIndex("properties_name_uq").on(t.workspaceId, sql`lower(${t.name})`).where(sql`${t.deletedAt} is null`),
  index("properties_ws_version_ix").on(t.workspaceId, t.version),
]);

export const units = app.table("units", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  label: text("label").notNull(),
  type: text("type").notNull(),
  floorLabel: text("floor_label"),
  defaultRentMinor: money("default_rent_minor"),
  defaultDepositMinor: money("default_deposit_minor"),
  notes: text("notes"),
  archivedAt: ts("archived_at"),
  ...sync(),
}, (t) => [
  uniqueIndex("units_label_uq").on(t.propertyId, sql`lower(${t.label})`).where(sql`${t.deletedAt} is null`),
  index("units_property_ix").on(t.propertyId),
  index("units_ws_version_ix").on(t.workspaceId, t.version),
]);

export const tenants = app.table("tenants", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  kind: text("kind").notNull().default("INDIVIDUAL"),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  altPhone: text("alt_phone"),
  email: text("email"),
  address: text("address"),
  emergencyName: text("emergency_name"),
  emergencyPhone: text("emergency_phone"),
  idType: text("id_type"),
  idLast4: text("id_last4"),
  notes: text("notes"),
  archivedAt: ts("archived_at"),
  ...sync(),
}, (t) => [
  index("tenants_phone_ix").on(t.workspaceId, t.phone),
  index("tenants_ws_version_ix").on(t.workspaceId, t.version),
]);

export const tenancies = app.table("tenancies", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  status: text("status").notNull().default("ACTIVE"),
  currency: text("currency").notNull(),
  startDate: day("start_date").notNull(),
  billingStartDate: day("billing_start_date").notNull(),
  leaseEndDate: day("lease_end_date"),
  cycleDay: smallint("cycle_day").notNull().default(1),
  graceDays: smallint("grace_days").notNull().default(4),
  noticePeriodDays: smallint("notice_period_days"),
  depositAgreedMinor: money("deposit_agreed_minor").notNull().default(0),
  noticeGivenOn: day("notice_given_on"),
  noticeGivenBy: text("notice_given_by"),
  plannedMoveOutDate: day("planned_move_out_date"),
  movedOutOn: day("moved_out_on"),
  closedAt: ts("closed_at"),
  cancelledAt: ts("cancelled_at"),
  cancelReason: text("cancel_reason"),
  notes: text("notes"),
  ...sync(),
}, (t) => [
  index("tenancies_unit_ix").on(t.unitId),
  index("tenancies_status_ix").on(t.workspaceId, t.status),
  index("tenancies_ws_version_ix").on(t.workspaceId, t.version),
]);

export const tenancyParties = app.table("tenancy_parties", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  tenancyId: uuid("tenancy_id").notNull().references(() => tenancies.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  role: text("role").notNull(),
  joinedOn: day("joined_on"),
  leftOn: day("left_on"),
  ...sync(),
}, (t) => [
  uniqueIndex("parties_uq").on(t.tenancyId, t.tenantId).where(sql`${t.deletedAt} is null`),
  index("parties_tenant_ix").on(t.tenantId),
]);

export const rentRevisions = app.table("rent_revisions", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  tenancyId: uuid("tenancy_id").notNull().references(() => tenancies.id),
  effectiveFrom: day("effective_from").notNull(),
  rentMinor: money("rent_minor").notNull(),
  reason: text("reason"),
  ...sync(),
}, (t) => [uniqueIndex("revisions_uq").on(t.tenancyId, t.effectiveFrom).where(sql`${t.deletedAt} is null`)]);

export const settlements = app.table("settlements", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  tenancyId: uuid("tenancy_id").notNull().references(() => tenancies.id),
  status: text("status").notNull().default("FINAL"),
  movedOutOn: day("moved_out_on").notNull(),
  depositAppliedMinor: money("deposit_applied_minor").notNull().default(0),
  refundDueMinor: money("refund_due_minor").notNull().default(0),
  amountOwedMinor: money("amount_owed_minor").notNull().default(0),
  finalizedAt: ts("finalized_at"),
  ...sync(),
});

export const ledgerEntries = app.table("ledger_entries", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  tenancyId: uuid("tenancy_id").notNull().references(() => tenancies.id),
  kind: text("kind").notNull(),
  account: text("account").notNull(),
  category: text("category"),
  amountMinor: money("amount_minor").notNull(),
  currency: text("currency").notNull(),
  entryDate: day("entry_date").notNull(),
  dueDate: day("due_date"),
  periodStart: day("period_start"),
  periodEnd: day("period_end"),
  description: text("description"),
  method: text("method"),
  reference: text("reference"),
  note: text("note"),
  receiptNumber: text("receipt_number"),
  source: text("source").notNull().default("MANUAL"),
  generatedKey: text("generated_key"),
  // Utility charge snapshot (10 §11): readings used, consumption and rate at billing time.
  meterReadingId: uuid("meter_reading_id"),
  previousReadingId: uuid("previous_reading_id"),
  quantity: numeric("quantity", { precision: 14, scale: 3 }),
  rate: numeric("rate", { precision: 12, scale: 4 }),
  fixedAmountMinor: money("fixed_amount_minor"),
  settlementId: uuid("settlement_id").references(() => settlements.id),
  relatedEntryId: uuid("related_entry_id"),
  status: text("status").notNull().default("ACTIVE"),
  voidReason: text("void_reason"),
  voidedAt: ts("voided_at"),
  voidedBy: uuid("voided_by"),
  possibleDuplicateOf: uuid("possible_duplicate_of"),
  ...sync(),
}, (t) => [
  index("ledger_balance_ix").on(t.tenancyId, t.account, t.status),
  index("ledger_reports_ix").on(t.workspaceId, t.kind, t.entryDate),
  uniqueIndex("ledger_receipt_uq").on(t.workspaceId, t.receiptNumber).where(sql`${t.receiptNumber} is not null`),
  uniqueIndex("ledger_generated_uq").on(t.generatedKey).where(sql`${t.generatedKey} is not null`),
]);

export const meters = app.table("meters", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  unitId: uuid("unit_id").references(() => units.id), // null = common meter
  type: text("type").notNull(),
  label: text("label").notNull(),
  serialNumber: text("serial_number"),
  uom: text("uom").notNull(),
  rate: numeric("rate", { precision: 12, scale: 4 }).notNull().default("0"), // major units per uom
  fixedChargeMinor: money("fixed_charge_minor").notNull().default(0),
  currency: text("currency").notNull(),
  notes: text("notes"),
  archivedAt: ts("archived_at"),
  ...sync(),
}, (t) => [
  uniqueIndex("meters_label_uq").on(t.propertyId, sql`coalesce(${t.unitId}, '00000000-0000-0000-0000-000000000000'::uuid)`, sql`lower(${t.label})`).where(sql`${t.deletedAt} is null`),
]);

export const meterReadings = app.table("meter_readings", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  meterId: uuid("meter_id").notNull().references(() => meters.id),
  tenancyId: uuid("tenancy_id").references(() => tenancies.id),
  readingDate: day("reading_date").notNull(),
  value: numeric("value", { precision: 14, scale: 3 }).notNull(),
  readingType: text("reading_type").notNull().default("REGULAR"),
  note: text("note"),
  status: text("status").notNull().default("ACTIVE"),
  voidReason: text("void_reason"),
  ...sync(),
}, (t) => [
  uniqueIndex("readings_uq").on(t.meterId, t.readingDate, t.readingType).where(sql`${t.status} = 'ACTIVE'`),
  index("readings_meter_date_ix").on(t.meterId, t.readingDate),
]);

export const expenses = app.table("expenses", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  propertyId: uuid("property_id").references(() => properties.id), // null = workspace-level
  unitId: uuid("unit_id").references(() => units.id),
  category: text("category").notNull(),
  amountMinor: money("amount_minor").notNull(),
  currency: text("currency").notNull(),
  expenseDate: day("expense_date").notNull(),
  payee: text("payee"),
  method: text("method"),
  reference: text("reference"),
  note: text("note"),
  status: text("status").notNull().default("ACTIVE"),
  voidReason: text("void_reason"),
  ...sync(),
}, (t) => [
  index("expenses_ws_date_ix").on(t.workspaceId, t.expenseDate),
  index("expenses_property_date_ix").on(t.propertyId, t.expenseDate),
]);

export const auditEvents = app.table("audit_events", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull(),
  actorId: uuid("actor_id"),
  source: text("source").notNull().default("WEB"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  changes: jsonb("changes"),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("audit_ws_at_ix").on(t.workspaceId, t.at)]);

export type Workspace = typeof workspaces.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type Tenancy = typeof tenancies.$inferSelect;
export type LedgerRow = typeof ledgerEntries.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Meter = typeof meters.$inferSelect;
export type MeterReading = typeof meterReadings.$inferSelect;
