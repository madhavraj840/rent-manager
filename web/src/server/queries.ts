import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { getDb, t } from "@/db";
import { allocate } from "@/lib/money";
import { generateDueCharges, toEntry, type Ctx } from "./commands";

export const todayIn = (timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());

/**
 * The signed-in member and workspace.
 * ponytail: local mode has one user and one workspace; Supabase Auth + workspace switcher replace this (M2, D-058).
 */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  await connection(); // always read fresh data, never prerender
  const db = await getDb();
  const [m] = await db
    .select({ userId: t.memberships.userId, userName: t.memberships.displayName, workspace: t.workspaces })
    .from(t.memberships)
    .innerJoin(t.workspaces, eq(t.workspaces.id, t.memberships.workspaceId))
    .where(eq(t.memberships.status, "ACTIVE"))
    .limit(1);
  if (!m?.userId) return null;
  return { userId: m.userId, userName: m.userName ?? undefined, workspace: m.workspace, today: todayIn(m.workspace.timeZone) };
});

export async function requireCtx() {
  const ctx = await getCtx();
  if (!ctx) redirect("/setup");
  return ctx;
}

/**
 * Everything the list pages need, with balances derived from the ledger.
 * ponytail: loads the whole workspace per request; switch to per-page queries + the FIFO SQL view (05 §6.1) past a few thousand tenancies.
 */
export const loadPortfolio = cache(async () => {
  const ctx = await requireCtx();
  await generateDueCharges(ctx);
  const db = await getDb();
  const ws = ctx.workspace.id;
  const [properties, units, tenancies, parties, tenants, ledger, revisions, expenses] = await Promise.all([
    db.select().from(t.properties).where(and(eq(t.properties.workspaceId, ws), isNull(t.properties.deletedAt))).orderBy(asc(t.properties.name)),
    db.select().from(t.units).where(and(eq(t.units.workspaceId, ws), isNull(t.units.deletedAt))).orderBy(asc(t.units.label)),
    db.select().from(t.tenancies).where(and(eq(t.tenancies.workspaceId, ws), ne(t.tenancies.status, "CANCELLED"), isNull(t.tenancies.deletedAt))),
    db.select().from(t.tenancyParties).where(and(eq(t.tenancyParties.workspaceId, ws), isNull(t.tenancyParties.deletedAt))),
    db.select().from(t.tenants).where(and(eq(t.tenants.workspaceId, ws), isNull(t.tenants.deletedAt))).orderBy(asc(t.tenants.fullName)),
    db.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.workspaceId, ws)),
    db.select().from(t.rentRevisions).where(and(eq(t.rentRevisions.workspaceId, ws), isNull(t.rentRevisions.deletedAt))).orderBy(desc(t.rentRevisions.effectiveFrom)),
    db.select().from(t.expenses).where(and(eq(t.expenses.workspaceId, ws), isNull(t.expenses.deletedAt))).orderBy(desc(t.expenses.expenseDate), desc(t.expenses.createdAt)),
  ]);

  const byTenancy = Map.groupBy(ledger, (r) => r.tenancyId);
  const tenantById = new Map(tenants.map((x) => [x.id, x]));
  const unitById = new Map(units.map((u) => [u.id, u]));
  const propById = new Map(properties.map((p) => [p.id, p]));

  const views = tenancies.map((tn) => {
    const rows = byTenancy.get(tn.id) ?? [];
    const entries = rows.map(toEntry);
    const balance = allocate(entries, ctx.today);
    const people = parties
      .filter((p) => p.tenancyId === tn.id && !p.leftOn)
      .sort((a, b) => (a.role === "PRIMARY" ? -1 : b.role === "PRIMARY" ? 1 : 0))
      .map((p) => tenantById.get(p.tenantId)!);
    const revs = revisions.filter((r) => r.tenancyId === tn.id);
    const rent = (revs.find((r) => r.effectiveFrom <= ctx.today) ?? revs[revs.length - 1])?.rentMinor ?? 0;
    return {
      tenancy: tn,
      rent,
      revisions: revs,
      unit: unitById.get(tn.unitId)!,
      property: propById.get(tn.propertyId)!,
      people,
      rows,
      entries,
      balance,
      nextDue: balance.charges.find((c) => c.remaining > 0)?.entry.dueDate,
    };
  });

  return { ctx, properties, units, tenants, views, expenses, current: views.filter((v) => v.tenancy.status === "ACTIVE") };
});

export type Portfolio = Awaited<ReturnType<typeof loadPortfolio>>;
export type TenancyView = Portfolio["views"][number];

export function monthSummary(views: TenancyView[], ym: string) {
  const rows = views.flatMap((v) => v.rows).filter((r) => r.status === "ACTIVE" && r.account === "RENT");
  const inMonth = (d?: string | null) => d?.startsWith(ym) ?? false;
  return {
    billed: rows.filter((r) => r.kind === "CHARGE" && inMonth(r.dueDate)).reduce((s, r) => s + r.amountMinor, 0),
    // Collected = payments − refunds of advance, by date (10 §13)
    collected:
      rows.filter((r) => r.kind === "PAYMENT" && r.method !== "INTERNAL_TRANSFER" && inMonth(r.entryDate)).reduce((s, r) => s + r.amountMinor, 0) -
      rows.filter((r) => r.kind === "REFUND" && inMonth(r.entryDate)).reduce((s, r) => s + r.amountMinor, 0),
    outstanding: views.reduce((s, v) => s + Math.max(v.balance.balance, 0), 0),
    overdue: views.reduce((s, v) => s + v.balance.overdue, 0),
    depositsHeld: views.reduce((s, v) => s + v.balance.depositHeld, 0),
  };
}

/** Active expenses in a month (YYYY-MM) for one currency, optionally one property (13 §2). */
export const expensesIn = (p: Portfolio, ym: string, currency: string, propertyId?: string) =>
  p.expenses
    .filter((e) => e.status === "ACTIVE" && e.currency === currency && e.expenseDate.startsWith(ym) && (!propertyId || e.propertyId === propertyId))
    .reduce((s, e) => s + e.amountMinor, 0);
