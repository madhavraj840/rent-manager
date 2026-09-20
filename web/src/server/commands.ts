import "server-only";
import { and, eq, gte, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { getDb, t, type DB } from "@/db";
import { putFile, removeFiles } from "./files";
import {
  addDays, allocate, formatMoney, formatScaled, moveOutCredit, nextPeriodStart, parseScaled, periodLabel, periodStartFor, rentSchedule, roundingUnit,
  utilityAmount, utilityDescription, type LedgerEntry,
} from "@/lib/money";
import { CREDIT_CATEGORIES, PERSON_DOCS, type PayTo } from "@/lib/labels";

// Every write goes through run(): one transaction, workspace change sequence, version stamping, audit (06 §6).

/** "1 Sep 2026" for messages people read (C-11). */
const niceDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export class DomainError extends Error {
  constructor(public code: string, message: string, public field?: string) {
    super(message);
  }
}

export interface Ctx {
  userId: string;
  userName?: string;
  workspace: typeof t.workspaces.$inferSelect;
  today: string;
}

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const pgCode = (e: unknown): string | undefined => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.cause?.code ?? err?.code;
};

async function run<T>(
  ctx: Ctx | null,
  action: string,
  entityType: string,
  fn: (tx: Tx) => Promise<{ entityId?: string; changes?: unknown; result: T }>,
  bootstrapWorkspaceId?: string,
): Promise<T> {
  const db = await getDb();
  try {
    return await db.transaction(async (tx) => {
      const wsId = ctx?.workspace.id ?? bootstrapWorkspaceId!;
      if (ctx) {
        const [c] = await tx
          .update(t.workspaceCounters)
          .set({ changeSeq: sql`${t.workspaceCounters.changeSeq} + 1` })
          .where(eq(t.workspaceCounters.workspaceId, wsId))
          .returning();
        await tx.execute(sql`select set_config('app.change_seq', ${String(c.changeSeq)}, true)`);
      } else {
        await tx.execute(sql`select set_config('app.change_seq', '1', true)`);
      }
      const r = await fn(tx);
      await tx.insert(t.auditEvents).values({
        workspaceId: wsId, actorId: ctx?.userId || null, action, entityType, entityId: r.entityId ?? null, changes: r.changes ?? null,
      });
      return r.result;
    });
  } catch (e) {
    if (e instanceof DomainError) throw e;
    const code = pgCode(e);
    if (code === "23P01") throw new DomainError("TENANCY_OVERLAP", "This room already has a tenant for these dates. Choose another room or change the dates.", "startDate");
    if (code === "23505") throw new DomainError("DUPLICATE", "That name is already used. Choose a different one.");
    if (code === "23514") throw new DomainError("VALIDATION", "Some values are outside the allowed range.");
    throw e;
  }
}

// ---------- Workspace ----------

/** `userId` is the signed-in Supabase user (cloud mode). Local mode has one profile, created on first run. */
export async function createWorkspace(input: { name: string; countryCode: string; currency: string; timeZone: string; fullName: string; email: string }, userId?: string) {
  const db = await getDb();
  const [existing] = await db.select().from(t.profiles).where(userId ? eq(t.profiles.id, userId) : undefined).limit(1);
  const profileId = existing?.id ?? userId ?? crypto.randomUUID();
  const wsId = crypto.randomUUID();
  return run(null, "workspace.create", "workspace", async (tx) => {
    if (!existing) await tx.insert(t.profiles).values({ id: profileId, fullName: input.fullName, email: input.email });
    await tx.insert(t.workspaces).values({
      id: wsId, name: input.name, countryCode: input.countryCode, defaultCurrency: input.currency, timeZone: input.timeZone, createdBy: profileId,
    });
    await tx.insert(t.workspaceCounters).values({ workspaceId: wsId, changeSeq: 1 });
    await tx.insert(t.memberships).values({
      workspaceId: wsId, userId: profileId, role: "OWNER", status: "ACTIVE", email: input.email, displayName: input.fullName, createdBy: profileId,
    });
    return { entityId: wsId, result: wsId };
  }, wsId);
}

// ---------- Properties and units ----------

export interface PropertyInput {
  name: string; type: string; addressLine1?: string; city?: string; region?: string; postalCode?: string;
  countryCode: string; currency: string; notes?: string;
}

/** SCR-11 Settings: business name, time zone, receipts, rounding, your display name and how tenants pay you. */
export function updateSettings(ctx: Ctx, input: {
  name: string; timeZone: string; receiptPrefix: string; roundToWholeUnits: boolean; displayName: string; payTo: PayTo;
}) {
  return run(ctx, "workspace.update", "workspace", async (tx) => {
    const has = Object.values(input.payTo).some((v) => v);
    const after = {
      name: input.name, timeZone: input.timeZone, receiptPrefix: input.receiptPrefix,
      roundToWholeUnits: input.roundToWholeUnits, paymentInstructions: has ? input.payTo : null,
    };
    await tx.update(t.workspaces).set({ ...after, updatedBy: ctx.userId }).where(eq(t.workspaces.id, ctx.workspace.id));
    await tx.update(t.memberships).set({ displayName: input.displayName, updatedBy: ctx.userId })
      .where(and(eq(t.memberships.workspaceId, ctx.workspace.id), eq(t.memberships.userId, ctx.userId)));
    const w = ctx.workspace;
    return {
      entityId: ctx.workspace.id,
      changes: { before: { name: w.name, timeZone: w.timeZone, receiptPrefix: w.receiptPrefix, roundToWholeUnits: w.roundToWholeUnits }, after },
      result: ctx.workspace.id,
    };
  });
}

export function createProperty(ctx: Ctx, input: PropertyInput) {
  return run(ctx, "property.create", "property", async (tx) => {
    const [p] = await tx.insert(t.properties).values({ ...input, workspaceId: ctx.workspace.id, createdBy: ctx.userId }).returning();
    return { entityId: p.id, changes: input, result: p.id };
  });
}

export function updateProperty(ctx: Ctx, id: string, input: PropertyInput) {
  return run(ctx, "property.update", "property", async (tx) => {
    const [before] = await tx.select().from(t.properties).where(and(eq(t.properties.id, id), eq(t.properties.workspaceId, ctx.workspace.id)));
    if (!before) throw new DomainError("NOT_FOUND", "Property not found.");
    if (before.currency !== input.currency) {
      const [used] = await tx.select({ id: t.tenancies.id }).from(t.tenancies).where(eq(t.tenancies.propertyId, id)).limit(1);
      if (used) throw new DomainError("CURRENCY_LOCKED", "The currency can't change once a tenant has been added.", "currency");
    }
    await tx.update(t.properties).set({ ...input, updatedBy: ctx.userId }).where(eq(t.properties.id, id));
    return { entityId: id, changes: { before, after: input }, result: id };
  });
}

export interface UnitInput { label: string; type: string; floorLabel?: string; defaultRentMinor?: number; defaultDepositMinor?: number }

export function addUnits(ctx: Ctx, propertyId: string, list: UnitInput[]) {
  return run(ctx, "unit.create_many", "property", async (tx) => {
    const [p] = await tx.select().from(t.properties).where(and(eq(t.properties.id, propertyId), eq(t.properties.workspaceId, ctx.workspace.id)));
    if (!p) throw new DomainError("NOT_FOUND", "Property not found.");
    const taken = new Set(
      (await tx.select({ label: t.units.label }).from(t.units).where(and(eq(t.units.propertyId, propertyId), isNull(t.units.deletedAt))))
        .map((u) => u.label.toLowerCase()),
    );
    const clash = list.find((u) => taken.has(u.label.toLowerCase()));
    if (clash) throw new DomainError("DUPLICATE_LABEL", `"${clash.label}" already exists in this property.`, "label");
    await tx.insert(t.units).values(list.map((u) => ({ ...u, propertyId, workspaceId: ctx.workspace.id, createdBy: ctx.userId })));
    return { entityId: propertyId, changes: { count: list.length }, result: list.length };
  });
}

// ---------- Ledger helpers ----------

export const toEntry = (r: typeof t.ledgerEntries.$inferSelect): LedgerEntry => ({
  id: r.id, tenancyId: r.tenancyId, account: r.account as LedgerEntry["account"], kind: r.kind as LedgerEntry["kind"],
  category: r.category ?? undefined, amount: r.amountMinor, entryDate: r.entryDate, dueDate: r.dueDate ?? undefined,
  description: r.description ?? "", method: r.method ?? undefined, receiptNo: r.receiptNumber ?? undefined, voided: r.status === "VOID",
});

async function balanceOf(tx: Tx, tenancyId: string, today: string) {
  const rows = await tx.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.tenancyId, tenancyId));
  return allocate(rows.map(toEntry), today);
}

async function loadTenancy(tx: Tx, ctx: Ctx, id: string) {
  const [tn] = await tx.select().from(t.tenancies).where(and(eq(t.tenancies.id, id), eq(t.tenancies.workspaceId, ctx.workspace.id)));
  if (!tn) throw new DomainError("NOT_FOUND", "Tenant record not found.");
  return tn;
}

/** An ENDED tenancy closes once rent balance and deposit held are both zero (10 §10.1 step 9). */
async function closeIfSettled(tx: Tx, ctx: Ctx, tn: typeof t.tenancies.$inferSelect) {
  if (tn.status !== "ENDED") return;
  const bal = await balanceOf(tx, tn.id, ctx.today);
  if (bal.balance === 0 && bal.depositHeld === 0)
    await tx.update(t.tenancies).set({ status: "CLOSED", closedAt: sql`now()` as unknown as string }).where(eq(t.tenancies.id, tn.id));
}

const assertOpen = (tn: typeof t.tenancies.$inferSelect) => {
  if (tn.status === "CLOSED" || tn.status === "CANCELLED")
    throw new DomainError("TENANCY_CLOSED", "This tenant has moved out. New entries can't be added.");
};

async function nextReceipt(tx: Tx, ctx: Ctx) {
  const [c] = await tx
    .update(t.workspaceCounters)
    .set({ receiptSeq: sql`${t.workspaceCounters.receiptSeq} + 1` })
    .where(eq(t.workspaceCounters.workspaceId, ctx.workspace.id))
    .returning();
  return ctx.workspace.receiptPrefix + String(c.receiptSeq).padStart(6, "0");
}

type NewEntry = Omit<typeof t.ledgerEntries.$inferInsert, "workspaceId" | "propertyId" | "tenancyId" | "currency">;

function entry(ctx: Ctx, tn: typeof t.tenancies.$inferSelect, e: NewEntry) {
  return { createdBy: ctx.userId || null, ...e, workspaceId: ctx.workspace.id, propertyId: tn.propertyId, tenancyId: tn.id, currency: tn.currency };
}

/**
 * Repeating monthly charges (F-MONEY-10): one charge per whole rent month from the start month.
 * Idempotent by generated_key, so adding one later fills in the months already gone by.
 */
async function generateExtras(tx: Tx, ctx: Ctx, tn: typeof t.tenancies.$inferSelect, until: string) {
  const list = await tx.select().from(t.recurringCharges)
    .where(and(eq(t.recurringCharges.tenancyId, tn.id), isNull(t.recurringCharges.deletedAt)));
  if (!list.length) return 0;
  const end = tn.movedOutOn ?? tn.plannedMoveOutDate;
  const limit = end && end < until ? end : until;
  const lines: NewEntry[] = [];
  for (const rc of list) {
    const stop = rc.endOn && rc.endOn < limit ? rc.endOn : limit;
    // Whole rent months only: a charge never starts before rent does.
    let s = periodStartFor(rc.startOn, tn.cycleDay);
    while (s < tn.billingStartDate) s = nextPeriodStart(s, tn.cycleDay);
    for (; s <= stop; s = nextPeriodStart(s, tn.cycleDay)) {
      const periodEnd = addDays(nextPeriodStart(s, tn.cycleDay), -1);
      lines.push({
        kind: "CHARGE", account: "RENT", category: rc.category, amountMinor: rc.amountMinor,
        entryDate: s, dueDate: addDays(s, tn.graceDays), periodStart: s, periodEnd,
        description: `${rc.description} · ${periodLabel(s, periodEnd, tn.cycleDay)}`,
        source: "AUTO", generatedKey: `extra:${rc.id}:${s}`,
      });
    }
  }
  if (!lines.length) return 0;
  const inserted = await tx.insert(t.ledgerEntries).values(lines.map((l) => entry(ctx, tn, l))).onConflictDoNothing().returning({ id: t.ledgerEntries.id });
  return inserted.length;
}

/** Rent charges for every period start up to `until` that don't exist yet (10 §6). Idempotent by generated_key. */
async function generateRent(tx: Tx, ctx: Ctx, tn: typeof t.tenancies.$inferSelect, until: string) {
  const end = tn.movedOutOn ?? tn.plannedMoveOutDate;
  const limit = end && end < until ? end : until;
  const revisions = await tx.select().from(t.rentRevisions).where(and(eq(t.rentRevisions.tenancyId, tn.id), isNull(t.rentRevisions.deletedAt)));
  const sorted = revisions.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const plan = rentSchedule({
    tenancyId: tn.id, billingStart: tn.billingStartDate, cycleDay: tn.cycleDay, graceDays: tn.graceDays, until: limit,
    unit: roundingUnit(tn.currency, ctx.workspace.roundToWholeUnits),
    rentAt: (s) => (sorted.find((r) => r.effectiveFrom <= s) ?? sorted[sorted.length - 1]).rentMinor,
  });
  if (!plan.length) return generateExtras(tx, ctx, tn, limit);
  const inserted = await tx
    .insert(t.ledgerEntries)
    .values(plan.map((c) => entry(ctx, tn, {
      kind: "CHARGE", account: "RENT", category: "RENT", amountMinor: c.amount, entryDate: c.periodStart, dueDate: c.dueDate,
      periodStart: c.periodStart, periodEnd: c.periodEnd, description: c.description, source: "AUTO", generatedKey: c.key,
    })))
    .onConflictDoNothing()
    .returning({ id: t.ledgerEntries.id });
  return inserted.length + (await generateExtras(tx, ctx, tn, limit));
}

/**
 * Catch-up rent generation for the whole workspace, run before pages read balances.
 * ponytail: runs on page load; becomes the hourly cron job (06 §9) when deployed.
 */
export async function generateDueCharges(ctx: Ctx) {
  // Rent only falls due when the date changes; tenancy commands generate their own charges.
  const done = ((globalThis as { __rentChecked?: Map<string, string> }).__rentChecked ??= new Map());
  if (done.get(ctx.workspace.id) === ctx.today) return;
  const db = await getDb();
  const active = await db.select().from(t.tenancies).where(and(eq(t.tenancies.workspaceId, ctx.workspace.id), eq(t.tenancies.status, "ACTIVE"), isNull(t.tenancies.deletedAt)));
  if (!active.length) return void done.set(ctx.workspace.id, ctx.today);
  const keys = new Set(
    (await db.select({ k: t.ledgerEntries.generatedKey }).from(t.ledgerEntries)
      .where(and(eq(t.ledgerEntries.workspaceId, ctx.workspace.id), eq(t.ledgerEntries.source, "AUTO")))).map((r) => r.k),
  );
  const extras = await db.select().from(t.recurringCharges)
    .where(and(eq(t.recurringCharges.workspaceId, ctx.workspace.id), isNull(t.recurringCharges.deletedAt)));
  const due = active.filter((tn) => {
    const end = tn.movedOutOn ?? tn.plannedMoveOutDate;
    const limit = end && end < ctx.today ? end : ctx.today;
    let s = tn.billingStartDate;
    for (; s <= limit; s = nextPeriodStart(periodStartFor(s, tn.cycleDay), tn.cycleDay)) if (!keys.has(`rent:${tn.id}:${s}`)) return true;
    for (const rc of extras.filter((x) => x.tenancyId === tn.id)) {
      const stop = rc.endOn && rc.endOn < limit ? rc.endOn : limit;
      let p = periodStartFor(rc.startOn, tn.cycleDay);
      while (p < tn.billingStartDate) p = nextPeriodStart(p, tn.cycleDay);
      for (; p <= stop; p = nextPeriodStart(p, tn.cycleDay)) if (!keys.has(`extra:${rc.id}:${p}`)) return true;
    }
    return false;
  });
  if (due.length) {
    const ok = await run({ ...ctx, userId: "" }, "rent.generate", "workspace", async (tx) => {
      let n = 0;
      for (const tn of due) n += await generateRent(tx, ctx, tn, ctx.today);
      return { entityId: ctx.workspace.id, changes: { charges: n }, result: true };
    }).catch(() => false); // a concurrent request may have generated them already; retry next load
    if (!ok) return;
  }
  done.set(ctx.workspace.id, ctx.today);
}

// ---------- Tenancies ----------

export interface StartTenancyInput {
  unitId: string;
  tenantId?: string;
  tenant?: { fullName: string; phone?: string; email?: string };
  coTenants: string[];
  startDate: string;
  existing: boolean;
  billingStart?: string;
  cycleDay: number;
  graceDays: number;
  rentMinor: number;
  depositMinor: number;
  depositHeldMinor: number;
  openingOwedMinor: number;
  openingAdvanceMinor: number;
  leaseEndDate?: string;
}

export function startTenancy(ctx: Ctx, input: StartTenancyInput) {
  return run(ctx, input.existing ? "tenancy.add_existing" : "tenancy.start", "tenancy", async (tx) => {
    const [unit] = await tx.select().from(t.units).where(and(eq(t.units.id, input.unitId), eq(t.units.workspaceId, ctx.workspace.id)));
    if (!unit) throw new DomainError("NOT_FOUND", "Choose a room.", "unitId");
    const [prop] = await tx.select().from(t.properties).where(eq(t.properties.id, unit.propertyId));
    if (input.startDate > addDays(ctx.today, 365)) throw new DomainError("VALIDATION", "The move-in date is too far in the future.", "startDate");

    const billingStart = input.existing ? input.billingStart! : input.startDate;
    if (input.existing) {
      if (billingStart < input.startDate) throw new DomainError("VALIDATION", "Rent can't start before the tenant moved in.", "billingStart");
      if (periodStartFor(billingStart, input.cycleDay) !== billingStart)
        throw new DomainError("PERIOD_NOT_ALIGNED", `Rent must start on a rent day (the ${input.cycleDay}${input.cycleDay === 1 ? "st" : "th"}).`, "billingStart");
      if (input.depositHeldMinor > input.depositMinor)
        throw new DomainError("DEPOSIT_EXCEEDS_DUE", "The deposit you already hold can't be more than the agreed deposit.", "depositHeld");
    }

    let tenantId = input.tenantId;
    // A picked tenant must belong to this account (never trust an ID from the browser).
    if (tenantId && !(await tx.select({ id: t.tenants.id }).from(t.tenants).where(and(eq(t.tenants.id, tenantId), eq(t.tenants.workspaceId, ctx.workspace.id)))).length)
      throw new DomainError("NOT_FOUND", "Tenant not found.", "tenantId");
    if (!tenantId) {
      const [tt] = await tx.insert(t.tenants).values({ ...input.tenant!, workspaceId: ctx.workspace.id, createdBy: ctx.userId }).returning();
      tenantId = tt.id;
    }
    const [tn] = await tx.insert(t.tenancies).values({
      workspaceId: ctx.workspace.id, propertyId: unit.propertyId, unitId: unit.id, currency: prop.currency,
      startDate: input.startDate, billingStartDate: billingStart, leaseEndDate: input.leaseEndDate || null,
      cycleDay: input.cycleDay, graceDays: input.graceDays, depositAgreedMinor: input.depositMinor, createdBy: ctx.userId,
    }).returning();

    await tx.insert(t.tenancyParties).values({
      workspaceId: ctx.workspace.id, propertyId: tn.propertyId, tenancyId: tn.id, tenantId, role: "PRIMARY", joinedOn: input.startDate, createdBy: ctx.userId,
    });
    for (const name of input.coTenants) {
      const [co] = await tx.insert(t.tenants).values({ fullName: name, workspaceId: ctx.workspace.id, createdBy: ctx.userId }).returning();
      await tx.insert(t.tenancyParties).values({
        workspaceId: ctx.workspace.id, propertyId: tn.propertyId, tenancyId: tn.id, tenantId: co.id, role: "CO_TENANT", joinedOn: input.startDate, createdBy: ctx.userId,
      });
    }
    await tx.insert(t.rentRevisions).values({
      workspaceId: ctx.workspace.id, propertyId: tn.propertyId, tenancyId: tn.id, effectiveFrom: billingStart, rentMinor: input.rentMinor, reason: "Initial rent", createdBy: ctx.userId,
    });

    const ob = addDays(billingStart, -1); // opening entries date (10 §9)
    const depDate = input.existing ? ob : input.startDate;
    const lines: NewEntry[] = [];
    if (input.depositMinor > 0)
      lines.push({ kind: "CHARGE", account: "DEPOSIT", category: "DEPOSIT", amountMinor: input.depositMinor, entryDate: depDate, dueDate: depDate, description: "Security deposit", source: input.existing ? "OPENING" : "MOVE_IN" });
    if (input.existing && input.depositHeldMinor > 0)
      lines.push({ kind: "PAYMENT", account: "DEPOSIT", method: "OPENING_BALANCE", amountMinor: input.depositHeldMinor, entryDate: ob, description: "Deposit already held", source: "OPENING" });
    if (input.existing && input.openingOwedMinor > 0)
      lines.push({ kind: "CHARGE", account: "RENT", category: "OPENING_BALANCE", amountMinor: input.openingOwedMinor, entryDate: ob, dueDate: ob, description: "Owed from before (before using this app)", source: "OPENING" });
    if (input.existing && input.openingAdvanceMinor > 0)
      lines.push({ kind: "CREDIT", account: "RENT", category: "OPENING_ADVANCE", amountMinor: input.openingAdvanceMinor, entryDate: ob, description: "Paid ahead from before (before using this app)", source: "OPENING" });
    if (lines.length) await tx.insert(t.ledgerEntries).values(lines.map((l) => entry(ctx, tn, l)));

    await generateRent(tx, ctx, tn, ctx.today);
    return { entityId: tn.id, changes: { unit: unit.label, rent: input.rentMinor }, result: tn.id };
  });
}

// ---------- Put away and delete for good (F-DATA-1) ----------

export type Thing = "PROPERTY" | "ROOM" | "TENANT";
const TABLE = { PROPERTY: t.properties, ROOM: t.units, TENANT: t.tenants } as const;
const NAME = { PROPERTY: "property", ROOM: "room", TENANT: "tenant" } as const;

async function loadThing(tx: Tx, ctx: Ctx, kind: Thing, id: string) {
  const table = TABLE[kind];
  const [row] = await tx.select().from(table).where(and(eq(table.id, id), eq(table.workspaceId, ctx.workspace.id), isNull(table.deletedAt)));
  if (!row) throw new DomainError("NOT_FOUND", `That ${NAME[kind]} was not found.`);
  return row as { id: string; archivedAt: string | null };
}

/** Rooms still being rented, which stop a property, a room or a person from being put away. */
async function inUse(tx: Tx, ctx: Ctx, kind: Thing, id: string) {
  const live = and(eq(t.tenancies.workspaceId, ctx.workspace.id), eq(t.tenancies.status, "ACTIVE"), isNull(t.tenancies.deletedAt));
  if (kind === "TENANT") {
    const rows = await tx.select({ id: t.tenancies.id }).from(t.tenancies)
      .innerJoin(t.tenancyParties, and(eq(t.tenancyParties.tenancyId, t.tenancies.id), isNull(t.tenancyParties.deletedAt)))
      .where(and(live, eq(t.tenancyParties.tenantId, id)));
    return rows.length;
  }
  const where = kind === "PROPERTY" ? eq(t.tenancies.propertyId, id) : eq(t.tenancies.unitId, id);
  return (await tx.select({ id: t.tenancies.id }).from(t.tenancies).where(and(live, where))).length;
}

/** Put a property, room or person away so it leaves the everyday lists. Nothing is lost. */
export function setPutAway(ctx: Ctx, input: { kind: Thing; id: string; away: boolean }) {
  return run(ctx, input.away ? "thing.put_away" : "thing.bring_back", NAME[input.kind], async (tx) => {
    const row = await loadThing(tx, ctx, input.kind, input.id);
    if (input.away && (await inUse(tx, ctx, input.kind, input.id)))
      throw new DomainError(
        "IN_USE",
        input.kind === "TENANT"
          ? "This person is renting a room right now. Move them out first, then put them away."
          : `This ${NAME[input.kind]} still has a tenant. Move them out first, then put it away.`,
      );
    const table = TABLE[input.kind];
    await tx.update(table).set({ archivedAt: input.away ? (sql`now()` as unknown as string) : null, updatedBy: ctx.userId }).where(eq(table.id, row.id));
    return { entityId: row.id, changes: { kind: input.kind, putAway: input.away }, result: row.id };
  });
}

/**
 * Delete for good. Only when nothing hangs off it, so no money record can ever disappear.
 * Anything with history can be put away instead.
 */
export function deleteForGood(ctx: Ctx, input: { kind: Thing; id: string }) {
  return run(ctx, "thing.delete", NAME[input.kind], async (tx) => {
    const row = await loadThing(tx, ctx, input.kind, input.id);
    const ws = ctx.workspace.id;
    const count = async (rows: Promise<unknown[]>) => (await rows).length;
    const stop = (what: string) =>
      new DomainError("HAS_HISTORY", `This ${NAME[input.kind]} cannot be deleted because it has ${what}. Put it away instead: nothing is lost and it leaves your lists.`);

    if (input.kind === "TENANT") {
      // A record removed as a mistake never happened, so it does not count as history.
      if (await count(tx.select({ id: t.tenancyParties.id }).from(t.tenancyParties)
        .innerJoin(t.tenancies, eq(t.tenancies.id, t.tenancyParties.tenancyId))
        .where(and(eq(t.tenancyParties.workspaceId, ws), eq(t.tenancyParties.tenantId, row.id), isNull(t.tenancyParties.deletedAt), ne(t.tenancies.status, "CANCELLED")))))
        throw stop("been in a room");
      if (await count(tx.select({ id: t.documents.id }).from(t.documents).where(and(eq(t.documents.workspaceId, ws), eq(t.documents.entityType, "TENANT"), eq(t.documents.entityId, row.id), isNull(t.documents.deletedAt)))))
        throw stop("documents");
    } else if (input.kind === "ROOM") {
      if (await count(tx.select({ id: t.tenancies.id }).from(t.tenancies).where(and(eq(t.tenancies.workspaceId, ws), eq(t.tenancies.unitId, row.id), isNull(t.tenancies.deletedAt)))))
        throw stop("had a tenant");
      if (await count(tx.select({ id: t.meters.id }).from(t.meters).where(and(eq(t.meters.workspaceId, ws), eq(t.meters.unitId, row.id), isNull(t.meters.deletedAt)))))
        throw stop("a meter");
    } else {
      if (await count(tx.select({ id: t.tenancies.id }).from(t.tenancies).where(and(eq(t.tenancies.workspaceId, ws), eq(t.tenancies.propertyId, row.id), isNull(t.tenancies.deletedAt)))))
        throw stop("had a tenant");
      if (await count(tx.select({ id: t.expenses.id }).from(t.expenses).where(and(eq(t.expenses.workspaceId, ws), eq(t.expenses.propertyId, row.id), isNull(t.expenses.deletedAt)))))
        throw stop("expenses");
      if (await count(tx.select({ id: t.meters.id }).from(t.meters).where(and(eq(t.meters.workspaceId, ws), eq(t.meters.propertyId, row.id), isNull(t.meters.deletedAt)))))
        throw stop("meters");
      if (await count(tx.select({ id: t.documents.id }).from(t.documents).where(and(eq(t.documents.workspaceId, ws), eq(t.documents.propertyId, row.id), isNull(t.documents.deletedAt)))))
        throw stop("documents");
      // Its empty rooms go with it.
      await tx.update(t.units).set({ deletedAt: sql`now()` as unknown as string, updatedBy: ctx.userId })
        .where(and(eq(t.units.propertyId, row.id), isNull(t.units.deletedAt)));
    }
    const table = TABLE[input.kind];
    await tx.update(table).set({ deletedAt: sql`now()` as unknown as string, updatedBy: ctx.userId }).where(eq(table.id, row.id));
    return { entityId: row.id, changes: { kind: input.kind }, result: row.id };
  });
}

// ---------- Money entries ----------

export function recordPayment(ctx: Ctx, input: {
  tenancyId: string; rentMinor: number; depositMinor: number; date: string; method: string; reference?: string; note?: string;
}) {
  return run(ctx, "payment.record", "tenancy", async (tx) => {
    const tn = await loadTenancy(tx, ctx, input.tenancyId);
    assertOpen(tn);
    if (input.rentMinor <= 0 && input.depositMinor <= 0) throw new DomainError("VALIDATION", "Enter an amount.", "rent");
    if (input.date > addDays(ctx.today, 1) || input.date < addDays(tn.startDate, -365))
      throw new DomainError("DATE_OUT_OF_RANGE", "That date is outside the allowed range.", "date");
    const bal = await balanceOf(tx, tn.id, ctx.today);
    if (input.depositMinor > bal.depositDue)
      throw new DomainError("DEPOSIT_EXCEEDS_DUE", `Only ${formatMoney(Math.max(bal.depositDue, 0), tn.currency)} is due towards the deposit.`, "deposit");

    const receipts: string[] = [];
    let duplicate = false;
    for (const [account, amount] of [["RENT", input.rentMinor], ["DEPOSIT", input.depositMinor]] as const) {
      if (amount <= 0) continue;
      const [dup] = await tx.select({ id: t.ledgerEntries.id }).from(t.ledgerEntries).where(and(
        eq(t.ledgerEntries.tenancyId, tn.id), eq(t.ledgerEntries.kind, "PAYMENT"), eq(t.ledgerEntries.account, account),
        eq(t.ledgerEntries.amountMinor, amount), eq(t.ledgerEntries.entryDate, input.date), eq(t.ledgerEntries.status, "ACTIVE"),
        gte(t.ledgerEntries.createdAt, sql`now() - interval '24 hours'`),
      )).limit(1);
      duplicate ||= !!dup;
      const receipt = await nextReceipt(tx, ctx);
      receipts.push(receipt);
      await tx.insert(t.ledgerEntries).values(entry(ctx, tn, {
        kind: "PAYMENT", account, amountMinor: amount, entryDate: input.date, method: input.method, reference: input.reference || null,
        note: input.note || null, receiptNumber: receipt, possibleDuplicateOf: dup?.id ?? null,
        description: account === "DEPOSIT" ? "Deposit received" : "Payment received",
      }));
    }
    await closeIfSettled(tx, ctx, tn);
    return { entityId: tn.id, changes: input, result: { receipts, duplicate } };
  });
}


export function addCharge(ctx: Ctx, input: { tenancyId: string; category: string; description: string; amountMinor: number; date: string; dueDate: string }) {
  return run(ctx, "charge.add", "tenancy", async (tx) => {
    const tn = await loadTenancy(tx, ctx, input.tenancyId);
    assertOpen(tn);
    if (input.dueDate < input.date) throw new DomainError("VALIDATION", "Due date can't be before the charge date.", "dueDate");
    await tx.insert(t.ledgerEntries).values(entry(ctx, tn, {
      kind: "CHARGE", account: "RENT", category: input.category, amountMinor: input.amountMinor, entryDate: input.date, dueDate: input.dueDate, description: input.description,
    }));
    return { entityId: tn.id, changes: input, result: tn.id };
  });
}

export function addCredit(ctx: Ctx, input: { tenancyId: string; category: string; amountMinor: number; date: string; reason: string }) {
  return run(ctx, "credit.add", "tenancy", async (tx) => {
    const tn = await loadTenancy(tx, ctx, input.tenancyId);
    assertOpen(tn);
    const label = CREDIT_CATEGORIES[input.category as keyof typeof CREDIT_CATEGORIES] ?? "Credit";
    await tx.insert(t.ledgerEntries).values(entry(ctx, tn, {
      kind: "CREDIT", account: "RENT", category: input.category, amountMinor: input.amountMinor, entryDate: input.date, description: `${label}: ${input.reason}`, note: input.reason,
    }));
    await closeIfSettled(tx, ctx, tn);
    return { entityId: tn.id, changes: input, result: tn.id };
  });
}

export function voidEntry(ctx: Ctx, input: { entryId: string; reason: string }) {
  return run(ctx, "ledger.void", "ledger_entry", async (tx) => {
    const [e] = await tx.select().from(t.ledgerEntries).where(and(eq(t.ledgerEntries.id, input.entryId), eq(t.ledgerEntries.workspaceId, ctx.workspace.id)));
    if (!e) throw new DomainError("NOT_FOUND", "Entry not found.");
    if (e.status === "VOID") throw new DomainError("ALREADY_VOID", "This entry is already cancelled.");
    if (e.settlementId) throw new DomainError("ENTRY_IN_SETTLEMENT", "This entry is part of a move-out final bill and can't be cancelled.");
    const tn = await loadTenancy(tx, ctx, e.tenancyId);
    assertOpen(tn);
    if (e.account === "DEPOSIT" && e.kind === "PAYMENT") {
      const bal = await balanceOf(tx, tn.id, ctx.today);
      if (bal.depositHeld - e.amountMinor < 0) throw new DomainError("DEPOSIT_INSUFFICIENT", "Cancelling this would make the deposit you hold less than zero.");
    }
    await tx.update(t.ledgerEntries).set({ status: "VOID", voidReason: input.reason, voidedAt: sql`now()`, voidedBy: ctx.userId, updatedBy: ctx.userId })
      .where(eq(t.ledgerEntries.id, e.id));
    return { entityId: e.id, changes: { reason: input.reason, amount: e.amountMinor, kind: e.kind }, result: tn.id };
  });
}

// ---------- Repeating monthly charges (F-MONEY-10) ----------

export function addRecurringCharge(ctx: Ctx, input: {
  tenancyId: string; category: string; description: string; amountMinor: number; startOn: string; endOn?: string;
}) {
  return run(ctx, "recurring.add", "recurring_charge", async (tx) => {
    const tn = await loadTenancy(tx, ctx, input.tenancyId);
    if (tn.status !== "ACTIVE") throw new DomainError("TENANCY_CLOSED", "This tenant has already moved out.");
    if (input.amountMinor <= 0) throw new DomainError("VALIDATION", "Enter an amount.", "amount");
    if (input.endOn && input.endOn < input.startOn) throw new DomainError("VALIDATION", "The last month can't be before the first month.", "endOn");
    if (input.startOn > addDays(ctx.today, 366)) throw new DomainError("VALIDATION", "That first month is too far ahead.", "startOn");
    const [rc] = await tx.insert(t.recurringCharges).values({
      workspaceId: ctx.workspace.id, propertyId: tn.propertyId, tenancyId: tn.id, category: input.category,
      description: input.description, amountMinor: input.amountMinor, startOn: input.startOn, endOn: input.endOn ?? null, createdBy: ctx.userId,
    }).returning();
    const made = await generateExtras(tx, ctx, tn, ctx.today);
    return { entityId: rc.id, changes: { ...input, chargesMade: made }, result: made };
  });
}

/** Stop a repeating charge from a date on. Charges already made stay; cancel them one by one if they are wrong. */
export function stopRecurringCharge(ctx: Ctx, input: { id: string; endOn: string }) {
  return run(ctx, "recurring.stop", "recurring_charge", async (tx) => {
    const [rc] = await tx.select().from(t.recurringCharges)
      .where(and(eq(t.recurringCharges.id, input.id), eq(t.recurringCharges.workspaceId, ctx.workspace.id), isNull(t.recurringCharges.deletedAt)));
    if (!rc) throw new DomainError("NOT_FOUND", "That repeating charge was not found.");
    if (input.endOn < rc.startOn) throw new DomainError("VALIDATION", `It can't stop before it starts (${niceDate(rc.startOn)}).`, "endOn");
    await tx.update(t.recurringCharges).set({ endOn: input.endOn, updatedBy: ctx.userId }).where(eq(t.recurringCharges.id, rc.id));
    return { entityId: rc.id, changes: { before: { endOn: rc.endOn }, after: { endOn: input.endOn } }, result: rc.id };
  });
}

/** Give money back while the tenant is still on the books: advance paid ahead, or deposit held. */
export function refundMoney(ctx: Ctx, input: { tenancyId: string; account: "RENT" | "DEPOSIT"; amountMinor: number; date: string; method: string; note?: string }) {
  return run(ctx, "refund.record", "tenancy", async (tx) => {
    const tn = await loadTenancy(tx, ctx, input.tenancyId);
    assertOpen(tn);
    if (input.amountMinor <= 0) throw new DomainError("VALIDATION", "Enter an amount.", "amount");
    if (input.date > addDays(ctx.today, 1)) throw new DomainError("DATE_OUT_OF_RANGE", "The date can't be in the future.", "date");
    const bal = await balanceOf(tx, tn.id, ctx.today);
    const most = input.account === "DEPOSIT" ? bal.depositHeld : Math.max(-bal.balance, 0);
    const what = input.account === "DEPOSIT" ? "deposit you hold" : "advance the tenant has paid ahead";
    if (most <= 0) throw new DomainError("NOTHING_TO_REFUND", `There is no ${what} to give back.`, "amount");
    if (input.amountMinor > most)
      throw new DomainError("REFUND_EXCEEDS_HELD", `Only ${formatMoney(most, tn.currency)} can be given back. That is the ${what}.`, "amount");
    await tx.insert(t.ledgerEntries).values(entry(ctx, tn, {
      kind: "REFUND", account: input.account, amountMinor: input.amountMinor, entryDate: input.date, method: input.method, note: input.note || null,
      description: input.account === "DEPOSIT" ? "Deposit returned" : "Advance returned",
    }));
    await closeIfSettled(tx, ctx, tn);
    return { entityId: tn.id, changes: input, result: tn.id };
  });
}

/**
 * Undo a room record added by mistake (F-TNCY-9). Only while no money has been received or given back:
 * the room goes free again and every charge it made is crossed out.
 */
export function cancelTenancy(ctx: Ctx, input: { tenancyId: string; reason: string }) {
  return run(ctx, "tenancy.cancel", "tenancy", async (tx) => {
    const tn = await loadTenancy(tx, ctx, input.tenancyId);
    if (tn.status !== "ACTIVE") throw new DomainError("TENANCY_CLOSED", "This record can no longer be undone. Use Move out instead.");
    const rows = await tx.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.tenancyId, tn.id));
    const active = rows.filter((r) => r.status === "ACTIVE");
    const paid = active.filter((r) => r.kind === "PAYMENT" || r.kind === "REFUND");
    if (paid.length)
      throw new DomainError(
        "TENANCY_HAS_MONEY",
        `Money has already been recorded here (${paid.length} ${paid.length === 1 ? "entry" : "entries"}). Cancel those entries first, or use Move out instead.`,
      );
    if (active.length)
      await tx.update(t.ledgerEntries).set({ status: "VOID", voidReason: "Room record was added by mistake", voidedAt: sql`now()`, voidedBy: ctx.userId })
        .where(inArray(t.ledgerEntries.id, active.map((r) => r.id)));
    await tx.update(t.tenancies).set({ status: "CANCELLED", cancelledAt: sql`now()` as unknown as string, cancelReason: input.reason, updatedBy: ctx.userId })
      .where(eq(t.tenancies.id, tn.id));
    return { entityId: tn.id, changes: { reason: input.reason, chargesCancelled: active.length }, result: tn.id };
  });
}

// ---------- Move-out settlement (10 §10) ----------

export interface Deduction { category: "DAMAGE" | "CLEANING" | "OTHER"; amountMinor: number; reason: string }

/** Pure preview used by the move-out page and by finalize. */
export async function settlementPreview(ctx: Ctx, tenancyId: string, moveOut: string, deductions: Deduction[] = []) {
  const db = await getDb();
  const [tn] = await db.select().from(t.tenancies).where(and(eq(t.tenancies.id, tenancyId), eq(t.tenancies.workspaceId, ctx.workspace.id)));
  if (!tn) throw new DomainError("NOT_FOUND", "Tenant record not found.");
  const rows = (await db.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.tenancyId, tn.id))).filter((r) => r.status === "ACTIVE");
  const unit = roundingUnit(tn.currency, ctx.workspace.roundToWholeUnits);
  // Anything the app charges by itself — rent and the repeating monthly charges — stops after the move-out date.
  const auto = rows.filter((r) => r.kind === "CHARGE" && r.source === "AUTO" && r.periodStart);
  const rent = auto.filter((r) => r.category === "RENT");
  const voids = auto.filter((r) => r.periodStart! > moveOut);
  const proration = rent
    .filter((r) => r.periodStart! <= moveOut && r.periodEnd! > moveOut)
    .map((r) => ({ chargeId: r.id, description: r.description ?? "Rent", credit: moveOutCredit(r.amountMinor, r.periodStart!, moveOut, tn.cycleDay, unit) }))
    .filter((p) => p.credit > 0);

  const base = allocate(rows.map(toEntry), ctx.today);
  const voided = voids.reduce((s, r) => s + r.amountMinor, 0);
  const credits = proration.reduce((s, p) => s + p.credit, 0);
  const extra = deductions.reduce((s, d) => s + d.amountMinor, 0);
  const B = base.balance - voided - credits + extra;
  const H = base.depositHeld;
  const apply = Math.min(H, Math.max(B, 0));
  const B2 = B - apply;
  return {
    tenancy: tn, voids, proration, deductions, balanceBefore: base.balance, balanceAfterLines: B, depositHeld: H,
    depositApplied: apply, refundDeposit: H - apply, refundAdvance: Math.max(-B2, 0), amountOwed: Math.max(B2, 0),
  };
}

export async function finalizeMoveOut(ctx: Ctx, input: {
  tenancyId: string; moveOut: string; deductions: Deduction[]; refundNow: boolean; refundMethod: string; refundDate: string;
}) {
  if (input.moveOut > ctx.today) throw new DomainError("VALIDATION", "Move-out date can't be in the future. Record it on the day the tenant leaves.", "moveOut");
  const p = await settlementPreview(ctx, input.tenancyId, input.moveOut, input.deductions);
  const tn = p.tenancy;
  if (tn.status !== "ACTIVE") throw new DomainError("TENANCY_CLOSED", "This tenant has already moved out.");
  if (input.moveOut < tn.startDate) throw new DomainError("VALIDATION", `The move-out date can't be before they moved in (${niceDate(tn.startDate)}).`, "moveOut");

  return run(ctx, "settlement.finalize", "tenancy", async (tx) => {
    const [s] = await tx.insert(t.settlements).values({
      workspaceId: ctx.workspace.id, propertyId: tn.propertyId, tenancyId: tn.id, movedOutOn: input.moveOut,
      depositAppliedMinor: p.depositApplied, refundDueMinor: p.refundDeposit + p.refundAdvance, amountOwedMinor: p.amountOwed,
      finalizedAt: sql`now()` as unknown as string, createdBy: ctx.userId,
    }).returning();
    if (p.voids.length)
      await tx.update(t.ledgerEntries).set({ status: "VOID", voidReason: "Period after move-out", voidedAt: sql`now()`, voidedBy: ctx.userId })
        .where(inArray(t.ledgerEntries.id, p.voids.map((v) => v.id)));

    const lines: NewEntry[] = [
      ...p.proration.map((x) => ({
        kind: "CREDIT", account: "RENT", category: "PRORATION", amountMinor: x.credit, entryDate: input.moveOut,
        description: `Unused days after move-out (${x.description})`, relatedEntryId: x.chargeId,
      })),
      ...input.deductions.map((d) => ({
        kind: "CHARGE", account: "RENT", category: d.category, amountMinor: d.amountMinor, entryDate: input.moveOut, dueDate: input.moveOut, description: d.reason,
      })),
    ];
    if (p.depositApplied > 0)
      lines.push({ kind: "DEPOSIT_APPLIED", account: "RENT", amountMinor: p.depositApplied, entryDate: input.moveOut, description: "Deposit used for dues" });
    if (input.refundNow && p.refundDeposit > 0)
      lines.push({ kind: "REFUND", account: "DEPOSIT", amountMinor: p.refundDeposit, entryDate: input.refundDate, method: input.refundMethod, description: "Deposit returned" });
    if (input.refundNow && p.refundAdvance > 0)
      lines.push({ kind: "REFUND", account: "RENT", amountMinor: p.refundAdvance, entryDate: input.refundDate, method: input.refundMethod, description: "Advance returned" });
    if (lines.length)
      await tx.insert(t.ledgerEntries).values(lines.map((l) => entry(ctx, tn, { ...l, source: "SETTLEMENT", settlementId: s.id })));

    const bal = await balanceOf(tx, tn.id, ctx.today);
    const closed = bal.balance === 0 && bal.depositHeld === 0;
    await tx.update(t.tenancies).set({
      movedOutOn: input.moveOut, status: closed ? "CLOSED" : "ENDED", closedAt: closed ? sql`now()` as unknown as string : null, updatedBy: ctx.userId,
    }).where(eq(t.tenancies.id, tn.id));
    return { entityId: tn.id, changes: { settlement: s.id, closed }, result: { closed } };
  });
}

// ---------- Tenants and tenancy terms ----------

export interface TenantInput {
  fullName: string; phone?: string; altPhone?: string; email?: string; address?: string;
  emergencyName?: string; emergencyPhone?: string; notes?: string;
}

export function updateTenant(ctx: Ctx, id: string, input: TenantInput) {
  return run(ctx, "tenant.update", "tenant", async (tx) => {
    const [before] = await tx.select().from(t.tenants).where(and(eq(t.tenants.id, id), eq(t.tenants.workspaceId, ctx.workspace.id)));
    if (!before) throw new DomainError("NOT_FOUND", "Tenant not found.");
    const after = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v ?? null])) as Partial<typeof before>;
    await tx.update(t.tenants).set({ ...after, updatedBy: ctx.userId }).where(eq(t.tenants.id, id));
    return { entityId: id, changes: { before, after }, result: id };
  });
}

/** Lease end, days to pay and notes. Days to pay applies to charges generated from now on. */
export function updateTerms(ctx: Ctx, input: { tenancyId: string; leaseEndDate?: string; graceDays: number; notes?: string }) {
  return run(ctx, "tenancy.update_terms", "tenancy", async (tx) => {
    const tn = await loadTenancy(tx, ctx, input.tenancyId);
    if (tn.status !== "ACTIVE") throw new DomainError("TENANCY_CLOSED", "This tenant has already moved out.");
    if (input.leaseEndDate && input.leaseEndDate <= tn.startDate) throw new DomainError("VALIDATION", `The lease end must be after the move-in date (${niceDate(tn.startDate)}).`, "leaseEnd");
    const after = { leaseEndDate: input.leaseEndDate ?? null, graceDays: input.graceDays, notes: input.notes ?? null };
    await tx.update(t.tenancies).set({ ...after, updatedBy: ctx.userId }).where(eq(t.tenancies.id, tn.id));
    return { entityId: tn.id, changes: { before: { leaseEndDate: tn.leaseEndDate, graceDays: tn.graceDays, notes: tn.notes }, after }, result: tn.id };
  });
}

/** F-MOUT-1: rent stops being generated for periods starting after the planned date. */
export function giveNotice(ctx: Ctx, input: { tenancyId: string; noticeDate: string; plannedMoveOut: string; givenBy: "TENANT" | "LANDLORD" }) {
  return run(ctx, "tenancy.notice", "tenancy", async (tx) => {
    const tn = await loadTenancy(tx, ctx, input.tenancyId);
    if (tn.status !== "ACTIVE") throw new DomainError("TENANCY_CLOSED", "This tenant has already moved out.");
    if (input.plannedMoveOut < input.noticeDate) throw new DomainError("VALIDATION", "The leaving date can't be before the day they told you. Choose a later date.", "plannedMoveOut");
    if (input.plannedMoveOut < tn.startDate) throw new DomainError("VALIDATION", `The leaving date can't be before they moved in (${niceDate(tn.startDate)}). Choose a later date.`, "plannedMoveOut");
    await tx.update(t.tenancies).set({
      noticeGivenOn: input.noticeDate, noticeGivenBy: input.givenBy, plannedMoveOutDate: input.plannedMoveOut, updatedBy: ctx.userId,
    }).where(eq(t.tenancies.id, tn.id));
    return { entityId: tn.id, changes: input, result: tn.id };
  });
}

export function withdrawNotice(ctx: Ctx, tenancyId: string) {
  return run(ctx, "tenancy.notice_withdraw", "tenancy", async (tx) => {
    const tn = await loadTenancy(tx, ctx, tenancyId);
    if (tn.status !== "ACTIVE") throw new DomainError("TENANCY_CLOSED", "This tenant has already moved out.");
    await tx.update(t.tenancies).set({ noticeGivenOn: null, noticeGivenBy: null, plannedMoveOutDate: null, updatedBy: ctx.userId }).where(eq(t.tenancies.id, tn.id));
    await generateRent(tx, ctx, { ...tn, plannedMoveOutDate: null }, ctx.today);
    return { entityId: tn.id, changes: { withdrawn: tn.plannedMoveOutDate }, result: tn.id };
  });
}

/**
 * Rent change (10 §7). Periods already charged are never edited: each one from `effectiveFrom`
 * (up to the next later revision) gets an adjustment charge or credit for the difference.
 */
export function changeRent(ctx: Ctx, input: { tenancyId: string; effectiveFrom: string; rentMinor: number; reason?: string }) {
  return run(ctx, "rent.revise", "tenancy", async (tx) => {
    const tn = await loadTenancy(tx, ctx, input.tenancyId);
    if (tn.status !== "ACTIVE") throw new DomainError("TENANCY_CLOSED", "This tenant has already moved out.");
    const d = input.effectiveFrom;
    if (d <= tn.billingStartDate) throw new DomainError("VALIDATION", "Choose a date after rent started. To fix the first rent, cancel those charges instead.", "effectiveFrom");
    if (periodStartFor(d, tn.cycleDay) !== d)
      throw new DomainError("PERIOD_NOT_ALIGNED", `The new rent must start on a rent day (the ${tn.cycleDay}${tn.cycleDay === 1 ? "st" : "th"} of a month).`, "effectiveFrom");
    const revisions = await tx.select().from(t.rentRevisions).where(and(eq(t.rentRevisions.tenancyId, tn.id), isNull(t.rentRevisions.deletedAt)));
    if (revisions.some((r) => r.effectiveFrom === d)) throw new DomainError("DUPLICATE", "There is already a rent change from that date.", "effectiveFrom");
    const nextRev = revisions.map((r) => r.effectiveFrom).filter((x) => x > d).sort()[0];

    const [rev] = await tx.insert(t.rentRevisions).values({
      workspaceId: ctx.workspace.id, propertyId: tn.propertyId, tenancyId: tn.id, effectiveFrom: d, rentMinor: input.rentMinor,
      reason: input.reason || null, createdBy: ctx.userId,
    }).returning();

    const rows = (await tx.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.tenancyId, tn.id))).filter((r) => r.status === "ACTIVE");
    const charged = rows.filter((r) => r.source === "AUTO" && r.category === "RENT" && r.periodStart && r.periodStart >= d && (!nextRev || r.periodStart < nextRev));
    const lines: NewEntry[] = [];
    for (const c of charged) {
      // What this period currently costs, counting earlier adjustments to it.
      const adj = rows.filter((r) => r.source === "REVISION" && r.relatedEntryId === c.id).reduce((s, r) => s + (r.kind === "CHARGE" ? r.amountMinor : -r.amountMinor), 0);
      const diff = input.rentMinor - (c.amountMinor + adj);
      if (!diff) continue;
      const period = (c.description ?? "").replace(/^Rent · /, "");
      const text = `Rent adjustment · ${period} (${formatMoney(c.amountMinor + adj, tn.currency)} → ${formatMoney(input.rentMinor, tn.currency)})`;
      lines.push({
        kind: diff > 0 ? "CHARGE" : "CREDIT", account: "RENT", category: diff > 0 ? "RENT" : "ADJUSTMENT", amountMinor: Math.abs(diff),
        entryDate: ctx.today, dueDate: diff > 0 ? (c.dueDate! > ctx.today ? c.dueDate! : ctx.today) : null, description: text,
        source: "REVISION", relatedEntryId: c.id, generatedKey: `revadj:${rev.id}:${c.periodStart}`,
      });
    }
    if (lines.length) await tx.insert(t.ledgerEntries).values(lines.map((l) => entry(ctx, tn, l)));
    return { entityId: tn.id, changes: { ...input, adjustments: lines.length }, result: lines.length };
  });
}

// ---------- Expenses (F-EXP-1): not tenant-facing, so editable (audited) as well as voidable ----------

export interface ExpenseInput {
  propertyId?: string; unitId?: string; category: string; amountMinor: number; expenseDate: string;
  payee?: string; method?: string; reference?: string; note?: string;
}

async function expenseScope(tx: Tx, ctx: Ctx, input: ExpenseInput) {
  if (input.expenseDate > addDays(ctx.today, 1)) throw new DomainError("VALIDATION", "The date can't be in the future.", "expenseDate");
  if (!input.propertyId) {
    if (input.unitId) throw new DomainError("VALIDATION", "Choose the property for this room.", "propertyId");
    return ctx.workspace.defaultCurrency;
  }
  const [p] = await tx.select().from(t.properties).where(and(eq(t.properties.id, input.propertyId), eq(t.properties.workspaceId, ctx.workspace.id)));
  if (!p) throw new DomainError("NOT_FOUND", "Property not found.", "propertyId");
  if (input.unitId) {
    const [u] = await tx.select({ id: t.units.id }).from(t.units).where(and(eq(t.units.id, input.unitId), eq(t.units.propertyId, p.id)));
    if (!u) throw new DomainError("VALIDATION", "That room is not in this property.", "unitId");
  }
  return p.currency;
}

const expenseRow = (input: ExpenseInput) => ({
  propertyId: input.propertyId ?? null, unitId: input.unitId ?? null, category: input.category, amountMinor: input.amountMinor,
  expenseDate: input.expenseDate, payee: input.payee ?? null, method: input.method ?? null, reference: input.reference ?? null, note: input.note ?? null,
});

export function addExpense(ctx: Ctx, input: ExpenseInput) {
  return run(ctx, "expense.create", "expense", async (tx) => {
    const currency = await expenseScope(tx, ctx, input);
    const [e] = await tx.insert(t.expenses).values({ ...expenseRow(input), currency, workspaceId: ctx.workspace.id, createdBy: ctx.userId }).returning();
    return { entityId: e.id, changes: input, result: e.id };
  });
}

export function updateExpense(ctx: Ctx, id: string, input: ExpenseInput) {
  return run(ctx, "expense.update", "expense", async (tx) => {
    const [before] = await tx.select().from(t.expenses).where(and(eq(t.expenses.id, id), eq(t.expenses.workspaceId, ctx.workspace.id)));
    if (!before) throw new DomainError("NOT_FOUND", "Expense not found.");
    if (before.status === "VOID") throw new DomainError("ALREADY_VOID", "A cancelled expense can't be edited.");
    const currency = await expenseScope(tx, ctx, input);
    await tx.update(t.expenses).set({ ...expenseRow(input), currency, updatedBy: ctx.userId }).where(eq(t.expenses.id, id));
    return { entityId: id, changes: { before, after: input }, result: id };
  });
}

export function voidExpense(ctx: Ctx, id: string, reason: string) {
  return run(ctx, "expense.void", "expense", async (tx) => {
    const [e] = await tx.select().from(t.expenses).where(and(eq(t.expenses.id, id), eq(t.expenses.workspaceId, ctx.workspace.id)));
    if (!e) throw new DomainError("NOT_FOUND", "Expense not found.");
    if (e.status === "VOID") throw new DomainError("ALREADY_VOID", "This expense is already cancelled.");
    await tx.update(t.expenses).set({ status: "VOID", voidReason: reason, updatedBy: ctx.userId }).where(eq(t.expenses.id, id));
    return { entityId: id, changes: { reason, amount: e.amountMinor }, result: id };
  });
}

// ---------- Meters and readings (F-UTIL-1…3, 10 §11) ----------

export interface MeterInput {
  propertyId: string; unitId?: string; type: string; label: string; serialNumber?: string; uom: string;
  rateE4: number; fixedChargeMinor: number; notes?: string;
}

async function meterScope(tx: Tx, ctx: Ctx, input: MeterInput, exceptId?: string) {
  const [p] = await tx.select().from(t.properties).where(and(eq(t.properties.id, input.propertyId), eq(t.properties.workspaceId, ctx.workspace.id)));
  if (!p) throw new DomainError("NOT_FOUND", "Property not found.");
  if (input.unitId) {
    const [u] = await tx.select({ id: t.units.id }).from(t.units).where(and(eq(t.units.id, input.unitId), eq(t.units.propertyId, p.id)));
    if (!u) throw new DomainError("VALIDATION", "That room is not in this property.", "unitId");
  }
  const same = await tx.select({ id: t.meters.id, unitId: t.meters.unitId, label: t.meters.label }).from(t.meters)
    .where(and(eq(t.meters.propertyId, p.id), isNull(t.meters.deletedAt)));
  if (same.some((m) => m.id !== exceptId && (m.unitId ?? "") === (input.unitId ?? "") && m.label.toLowerCase() === input.label.toLowerCase()))
    throw new DomainError("DUPLICATE_LABEL", `There is already a meter called "${input.label}" here.`, "label");
  return p;
}

const meterRow = (input: MeterInput) => ({
  unitId: input.unitId ?? null, type: input.type, label: input.label, serialNumber: input.serialNumber ?? null, uom: input.uom,
  rate: formatScaled(input.rateE4, 4), fixedChargeMinor: input.fixedChargeMinor, notes: input.notes ?? null,
});

export function addMeter(ctx: Ctx, input: MeterInput) {
  return run(ctx, "meter.create", "meter", async (tx) => {
    const p = await meterScope(tx, ctx, input);
    const [m] = await tx.insert(t.meters).values({ ...meterRow(input), propertyId: p.id, currency: p.currency, workspaceId: ctx.workspace.id, createdBy: ctx.userId }).returning();
    return { entityId: m.id, changes: input, result: m.id };
  });
}

/** Rate changes apply to bills created from now on; past charges keep their snapshot. */
export function updateMeter(ctx: Ctx, id: string, input: MeterInput) {
  return run(ctx, "meter.update", "meter", async (tx) => {
    const [before] = await tx.select().from(t.meters).where(and(eq(t.meters.id, id), eq(t.meters.workspaceId, ctx.workspace.id)));
    if (!before) throw new DomainError("NOT_FOUND", "Meter not found.");
    await meterScope(tx, ctx, { ...input, propertyId: before.propertyId }, id);
    await tx.update(t.meters).set({ ...meterRow(input), updatedBy: ctx.userId }).where(eq(t.meters.id, id));
    return { entityId: id, changes: { before, after: input }, result: id };
  });
}

/** "₹9.50" style rate label, up to 4 decimals. */
export const rateLabel = (rate: string, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(rate));

export interface ReadingInput {
  meterId: string; date: string; valueMilli: number;
  replaced?: { oldFinalMilli: number; newStartMilli: number };
  bill: boolean; amountMinor?: number; dueDate?: string; note?: string;
}

const milli = (v: string) => parseScaled(v, 3)!;
const TYPE_ORDER: Record<string, number> = { METER_END: 0, METER_START: 1, MOVE_IN: 2, REGULAR: 3, MOVE_OUT: 4 };
type Reading = typeof t.meterReadings.$inferSelect;
const byTime = (a: Reading, b: Reading) => a.readingDate.localeCompare(b.readingDate) || TYPE_ORDER[a.readingType] - TYPE_ORDER[b.readingType];

/**
 * Save a reading and, when billable, its utility charge in one transaction (F-UTIL-2).
 * The first reading inside a tenancy is its starting (MOVE_IN) reading and is never billed.
 */
export function recordReading(ctx: Ctx, input: ReadingInput) {
  return run(ctx, "reading.record", "meter", async (tx) => {
    const [m] = await tx.select().from(t.meters).where(and(eq(t.meters.id, input.meterId), eq(t.meters.workspaceId, ctx.workspace.id)));
    if (!m || m.archivedAt) throw new DomainError("NOT_FOUND", "Meter not found.");
    if (input.date > ctx.today) throw new DomainError("VALIDATION", "The reading date can't be in the future.", "date");

    const readings = (await tx.select().from(t.meterReadings).where(and(eq(t.meterReadings.meterId, m.id), eq(t.meterReadings.status, "ACTIVE")))).sort(byTime);
    const last = readings.at(-1);
    if (last && input.date < last.readingDate) throw new DomainError("VALIDATION", `The last reading is from ${niceDate(last.readingDate)}. Choose that date or later.`, "date");
    if (last && input.date === last.readingDate) throw new DomainError("READING_DUPLICATE", "This meter already has a reading on that date.", "date");
    const lastMilli = last ? milli(last.value) : 0;
    if (input.replaced) {
      if (last && input.replaced.oldFinalMilli < lastMilli) throw new DomainError("VALIDATION", `The old meter's final reading can't be below ${formatScaled(lastMilli, 3)}.`, "oldFinal");
      if (input.valueMilli < input.replaced.newStartMilli) throw new DomainError("VALIDATION", "The reading can't be below the new meter's starting value.", "value");
    } else if (last && input.valueMilli < lastMilli) {
      throw new DomainError("VALIDATION", `The reading can't be lower than the last one (${formatScaled(lastMilli, 3)}). If the meter was replaced, tick "The meter was replaced".`, "value");
    }

    const [tn] = m.unitId
      ? (await tx.select().from(t.tenancies).where(and(eq(t.tenancies.unitId, m.unitId), eq(t.tenancies.status, "ACTIVE"), isNull(t.tenancies.deletedAt))))
        .filter((x) => x.startDate <= input.date)
      : [];
    const prev = tn ? readings.filter((r) => r.tenancyId === tn.id).at(-1) : undefined;

    const base = { workspaceId: ctx.workspace.id, propertyId: m.propertyId, meterId: m.id, readingDate: input.date, tenancyId: tn?.id ?? null, createdBy: ctx.userId };
    if (input.replaced)
      await tx.insert(t.meterReadings).values([
        { ...base, readingType: "METER_END", value: formatScaled(input.replaced.oldFinalMilli, 3) },
        { ...base, readingType: "METER_START", value: formatScaled(input.replaced.newStartMilli, 3) },
      ]);
    const [reading] = await tx.insert(t.meterReadings).values({
      ...base, readingType: tn && !prev ? "MOVE_IN" : "REGULAR", value: formatScaled(input.valueMilli, 3), note: input.note ?? null,
    }).returning();

    let charged = 0;
    if (tn && prev && input.bill) {
      const consumption = input.replaced
        ? input.replaced.oldFinalMilli - milli(prev.value) + (input.valueMilli - input.replaced.newStartMilli)
        : input.valueMilli - milli(prev.value);
      const amount = input.amountMinor
        ?? utilityAmount(consumption, parseScaled(m.rate, 4)!, m.fixedChargeMinor, m.currency, roundingUnit(m.currency, ctx.workspace.roundToWholeUnits));
      if (amount > 0) {
        const dueDate = input.dueDate ?? addDays(input.date, tn.graceDays);
        if (dueDate < input.date) throw new DomainError("VALIDATION", "Due date can't be before the reading date.", "dueDate");
        await tx.insert(t.ledgerEntries).values(entry(ctx, tn, {
          kind: "CHARGE", account: "RENT", category: "UTILITY", amountMinor: amount, entryDate: input.date, dueDate,
          description: utilityDescription(m.type, prev.readingDate, input.date, consumption, m.uom, rateLabel(m.rate, m.currency)),
          meterReadingId: reading.id, previousReadingId: prev.id, quantity: formatScaled(consumption, 3), rate: m.rate,
          fixedAmountMinor: m.fixedChargeMinor || null,
        }));
        charged = amount;
      }
    }
    return {
      entityId: m.id, changes: { ...input, reading: reading.id, charged },
      result: { charged, baseline: !!tn && !prev, tenancyId: tn?.id, currency: m.currency, vacant: !tn },
    };
  });
}

/** Only the latest reading can be voided (later consumption depends on it); its charge is voided with it. */
export function voidReading(ctx: Ctx, readingId: string, reason: string) {
  return run(ctx, "reading.void", "meter", async (tx) => {
    const [r] = await tx.select().from(t.meterReadings).where(and(eq(t.meterReadings.id, readingId), eq(t.meterReadings.workspaceId, ctx.workspace.id)));
    if (!r || r.status === "VOID") throw new DomainError("NOT_FOUND", "Reading not found.");
    const readings = (await tx.select().from(t.meterReadings).where(and(eq(t.meterReadings.meterId, r.meterId), eq(t.meterReadings.status, "ACTIVE")))).sort(byTime);
    if (readings.at(-1)!.id !== r.id) throw new DomainError("NOT_LATEST", "Only the latest reading can be cancelled. Cancel the later ones first.");
    const group = readings.filter((x) => x.readingDate === r.readingDate); // includes a same-day meter replacement
    const [charge] = await tx.select().from(t.ledgerEntries).where(and(eq(t.ledgerEntries.meterReadingId, r.id), eq(t.ledgerEntries.status, "ACTIVE")));
    if (charge?.settlementId) throw new DomainError("ENTRY_IN_SETTLEMENT", "This reading was billed in a move-out final bill and can't be cancelled.");
    await tx.update(t.meterReadings).set({ status: "VOID", voidReason: reason, updatedBy: ctx.userId }).where(inArray(t.meterReadings.id, group.map((x) => x.id)));
    if (charge)
      await tx.update(t.ledgerEntries).set({ status: "VOID", voidReason: `Reading cancelled: ${reason}`, voidedAt: sql`now()`, voidedBy: ctx.userId, updatedBy: ctx.userId })
        .where(eq(t.ledgerEntries.id, charge.id));
    return { entityId: r.meterId, changes: { reading: r.id, reason, charge: charge?.id }, result: r.meterId };
  });
}

// ---------- Documents (F-DOC-1…3) ----------

export const DOC_LIMITS = { maxBytes: 10 * 1024 * 1024, perParent: 50, quotaBytes: 1024 ** 3, keepDeletedDays: 30 };

/** The file's real type from its first bytes; the browser's claimed type is not trusted. */
export function sniffMime(b: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  return null;
}


const DOC_PARENTS = { PROPERTY: t.properties, TENANT: t.tenants, TENANCY: t.tenancies, EXPENSE: t.expenses } as const;
export type DocParent = keyof typeof DOC_PARENTS;

/** Throws a field error unless the bytes are an allowed file; returns its type. */
export function checkDocFile(bytes: Uint8Array, field = "file") {
  const mimeType = sniffMime(bytes);
  if (!mimeType) throw new DomainError("VALIDATION", "Choose a photo (JPG, PNG, WebP) or a PDF.", field);
  if (bytes.length > DOC_LIMITS.maxBytes) throw new DomainError("VALIDATION", "The file is larger than 10 MB. Choose a smaller file.", field);
  return mimeType;
}

export async function addDocument(ctx: Ctx, input: { entityType: DocParent; entityId: string; category: string; title?: string; fileName: string; bytes: Uint8Array }) {
  const mimeType = checkDocFile(input.bytes);
  await purgeDeletedDocuments(ctx);
  const id = crypto.randomUUID();
  const storagePath = `ws/${ctx.workspace.id}/${id}`;
  // The file is written first; if the record fails it is removed again, so no orphan row ever points at a missing file.
  await putFile(storagePath, input.bytes, mimeType);
  try {
    return await run(ctx, "document.add", "document", async (tx) => {
      const table = DOC_PARENTS[input.entityType];
      const [parent] = await tx.select().from(table).where(and(eq(table.id, input.entityId), eq(table.workspaceId, ctx.workspace.id)));
      if (!parent) throw new DomainError("NOT_FOUND", "The record this file belongs to was not found.");
      const propertyId = "propertyId" in parent ? parent.propertyId : input.entityType === "PROPERTY" ? parent.id : null;
      const live = and(eq(t.documents.workspaceId, ctx.workspace.id), isNull(t.documents.deletedAt));
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(t.documents)
        .where(and(live, eq(t.documents.entityType, input.entityType), eq(t.documents.entityId, input.entityId)));
      if (n >= DOC_LIMITS.perParent) throw new DomainError("LIMIT", `This record already has ${DOC_LIMITS.perParent} documents. Delete some first.`, "file");
      // Deleted files still use space until they are purged (F-DOC-3).
      const [{ used }] = await tx.select({ used: sql<number>`coalesce(sum(size_bytes), 0)::float8` }).from(t.documents).where(eq(t.documents.workspaceId, ctx.workspace.id));
      if (used + input.bytes.length > DOC_LIMITS.quotaBytes) throw new DomainError("QUOTA_EXCEEDED", "Storage full (1 GB). Delete old files or contact support.", "file");
      const sensitive = PERSON_DOCS.includes(input.category);
      await tx.insert(t.documents).values({
        id, workspaceId: ctx.workspace.id, propertyId, entityType: input.entityType, entityId: input.entityId, category: input.category,
        title: input.title ?? null, fileName: input.fileName.slice(0, 200), mimeType, sizeBytes: input.bytes.length, storagePath, sensitive,
        uploadedAt: sql`now()`, createdBy: ctx.userId, updatedBy: ctx.userId,
      });
      return { entityId: id, changes: { entityType: input.entityType, entityId: input.entityId, category: input.category, sizeBytes: input.bytes.length }, result: { id, sensitive } };
    });
  } catch (e) {
    await removeFiles([storagePath]).catch(() => undefined);
    throw e;
  }
}

export function setDocumentDeleted(ctx: Ctx, id: string, deleted: boolean) {
  return run(ctx, deleted ? "document.delete" : "document.restore", "document", async (tx) => {
    const [d] = await tx.update(t.documents).set({ deletedAt: deleted ? sql`now()` : null, updatedBy: ctx.userId })
      .where(and(eq(t.documents.id, id), eq(t.documents.workspaceId, ctx.workspace.id), deleted ? isNull(t.documents.deletedAt) : isNotNull(t.documents.deletedAt)))
      .returning();
    if (!d) throw new DomainError("NOT_FOUND", "Document not found.");
    return { entityId: id, result: d };
  });
}

/** Opening a sensitive document is audited (DOC-004). */
export async function openDocument(ctx: Ctx, id: string) {
  const db = await getDb();
  const [d] = await db.select().from(t.documents).where(and(eq(t.documents.id, id), eq(t.documents.workspaceId, ctx.workspace.id), isNull(t.documents.deletedAt)));
  if (d?.sensitive) await run(ctx, "document.view", "document", async () => ({ entityId: id, result: null }));
  return d;
}

// ponytail: purge runs on the next upload instead of a scheduled job; move to a cron when there is a hosted server.
async function purgeDeletedDocuments(ctx: Ctx) {
  const db = await getDb();
  const old = await db.delete(t.documents)
    .where(and(eq(t.documents.workspaceId, ctx.workspace.id), lt(t.documents.deletedAt, sql`now() - make_interval(days => ${DOC_LIMITS.keepDeletedDays})`)))
    .returning({ storagePath: t.documents.storagePath });
  await removeFiles(old.map((d) => d.storagePath));
}
