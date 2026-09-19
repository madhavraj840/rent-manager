import "server-only";
import { currencyDigits, daysBetween, runningBalances } from "@/lib/money";
import { EXPENSE_CATEGORIES, METHODS, label } from "@/lib/labels";
import type { Portfolio, TenancyView } from "./queries";

// Reports from docs/13. One table shape serves the page, the print view and CSV.

export type Money = { minor: number; currency: string };
export type Cell = string | number | null | undefined | Money;
export interface Column { label: string; money?: boolean; right?: boolean; wrap?: boolean }
export interface Table { columns: Column[]; rows: Cell[][]; href?: (string | undefined)[] }

export const REPORTS = {
  collections: "Money received",
  outstanding: "Unpaid",
  deposits: "Deposits held",
  "rent-roll": "Rooms and rent",
  expenses: "Expenses",
} as const;

/** Reports filtered by a date range rather than "as of today". */
export const RANGED: ReportType[] = ["collections", "expenses"];
export type ReportType = keyof typeof REPORTS;

const m = (minor: number, currency: string): Money => ({ minor, currency });
const isMoney = (c: Cell): c is Money => typeof c === "object" && c !== null;
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
const tenantName = (v: TenancyView) => v.people.map((p) => p.fullName).join(", ");
const sortViews = (vs: TenancyView[]) => vs.sort((a, b) => natural(a.property.name, b.property.name) || natural(a.unit.label, b.unit.label));
const lastPayment = (v: TenancyView) =>
  v.rows.filter((r) => r.kind === "PAYMENT" && r.account === "RENT" && r.status === "ACTIVE" && r.method !== "OPENING_BALANCE")
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate))[0];

/** REP-004: money in (and back out), excluding opening balances and internal transfers (13 §1). */
export function collections(p: Portfolio, from: string, to: string): Table {
  const hits = p.views.flatMap((v) => v.rows
    .filter((r) => (r.kind === "PAYMENT" || r.kind === "REFUND") && r.status === "ACTIVE" && r.entryDate >= from && r.entryDate <= to
      && r.method !== "OPENING_BALANCE" && r.method !== "INTERNAL_TRANSFER")
    .map((r) => ({ r, v })))
    .sort((a, b) => b.r.entryDate.localeCompare(a.r.entryDate) || (b.r.receiptNumber ?? "").localeCompare(a.r.receiptNumber ?? ""));
  return {
    columns: [{ label: "Date" }, { label: "Receipt" }, { label: "Tenant", wrap: true }, { label: "Room" }, { label: "Property", wrap: true }, { label: "For" }, { label: "Method" }, { label: "Reference" }, { label: "Amount", money: true }],
    rows: hits.map(({ r, v }) => [
      r.entryDate, r.receiptNumber, tenantName(v), v.unit.label, v.property.name,
      r.account === "DEPOSIT" ? (r.kind === "REFUND" ? "Deposit refund" : "Deposit") : r.kind === "REFUND" ? "Advance refund" : "Rent",
      label(METHODS, r.method), r.reference, m(r.kind === "REFUND" ? -r.amountMinor : r.amountMinor, r.currency),
    ]),
    href: hits.map(({ v }) => `/tenancies/${v.tenancy.id}`),
  };
}

/** REP-003: who owes what, and for how long (buckets by days past due). */
export function outstanding(p: Portfolio): Table {
  const today = p.ctx.today;
  const owing = sortViews(p.views.filter((v) => v.tenancy.status !== "CLOSED" && v.balance.balance > 0))
    .sort((a, b) => b.balance.balance - a.balance.balance);
  return {
    columns: [{ label: "Property", wrap: true }, { label: "Room" }, { label: "Tenant", wrap: true }, { label: "Phone" }, { label: "Not yet due", money: true },
      { label: "1–30 days", money: true }, { label: "31–60", money: true }, { label: "61–90", money: true }, { label: "90+", money: true },
      { label: "Total", money: true }, { label: "Oldest due" }, { label: "Last payment" }],
    rows: owing.map((v) => {
      const b = [0, 0, 0, 0, 0];
      const open = v.balance.charges.filter((c) => c.remaining > 0);
      for (const c of open) {
        const d = daysBetween(c.entry.dueDate!, today);
        b[d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4] += c.remaining;
      }
      const cur = v.tenancy.currency;
      return [v.property.name, v.unit.label, tenantName(v), v.people[0]?.phone, ...b.map((x) => m(x, cur)),
        m(v.balance.balance, cur), open[0]?.entry.dueDate, lastPayment(v)?.entryDate];
    }),
    href: owing.map((v) => `/tenancies/${v.tenancy.id}`),
  };
}

/** REP-006: deposits are money held for tenants, not income. */
export function deposits(p: Portfolio): Table {
  const list = sortViews(p.views.filter((v) => v.rows.some((r) => r.account === "DEPOSIT" || r.kind === "DEPOSIT_APPLIED")));
  return {
    columns: [{ label: "Property", wrap: true }, { label: "Room" }, { label: "Tenant", wrap: true }, { label: "Tenant status" }, { label: "Agreed", money: true },
      { label: "Received", money: true }, { label: "Used for dues", money: true }, { label: "Returned", money: true },
      { label: "Held", money: true }, { label: "Still due", money: true }, { label: "Status" }],
    rows: list.map((v) => {
      const act = v.rows.filter((r) => r.status === "ACTIVE");
      const sum = (kind: string, account = "DEPOSIT") => act.filter((r) => r.kind === kind && r.account === account).reduce((s, r) => s + r.amountMinor, 0);
      const cur = v.tenancy.currency;
      const b = v.balance;
      const status = b.depositDue > 0 ? "Collecting" : b.depositHeld > 0 ? (v.tenancy.status === "ACTIVE" ? "Held" : "Refund due") : "Settled";
      return [v.property.name, v.unit.label, tenantName(v), v.tenancy.status === "ACTIVE" ? "Current" : "Moved out",
        m(sum("CHARGE") - sum("CREDIT"), cur), m(sum("PAYMENT"), cur), m(sum("DEPOSIT_APPLIED", "RENT"), cur), m(sum("REFUND"), cur),
        m(b.depositHeld, cur), m(Math.max(b.depositDue, 0), cur), status];
    }),
    href: list.map((v) => `/tenancies/${v.tenancy.id}`),
  };
}

/** REP-002: every unit and what it earns. */
export function rentRoll(p: Portfolio): Table {
  const today = p.ctx.today;
  const units = [...p.units].filter((u) => !u.archivedAt).map((u) => ({ u, prop: p.properties.find((x) => x.id === u.propertyId)! }))
    .sort((a, b) => natural(a.prop.name, b.prop.name) || natural(a.u.label, b.u.label));
  const rows = units.map(({ u, prop }) => {
    const v = p.views.find((x) => x.unit.id === u.id && x.tenancy.status === "ACTIVE");
    if (!v) return { v, row: [prop.name, u.label, "Vacant", "", "", "", "", "", "", "", ""] as Cell[] };
    const tn = v.tenancy;
    const status = tn.startDate > today ? "Upcoming" : tn.plannedMoveOutDate ? `Leaving on ${tn.plannedMoveOutDate}` : "Let";
    const last = lastPayment(v);
    return {
      v,
      row: [prop.name, u.label, status, tenantName(v), tn.startDate, tn.leaseEndDate, m(v.rent, tn.currency), m(v.balance.depositHeld, tn.currency),
        m(v.balance.balance, tn.currency), m(v.balance.overdue, tn.currency), last ? `${last.entryDate}` : ""] as Cell[],
    };
  });
  return {
    columns: [{ label: "Property", wrap: true }, { label: "Room" }, { label: "Status" }, { label: "Tenant", wrap: true }, { label: "Moved in" }, { label: "Agreement ends" },
      { label: "Rent", money: true }, { label: "Deposit held", money: true }, { label: "Owes", money: true }, { label: "Overdue", money: true }, { label: "Last payment" }],
    rows: rows.map((r) => r.row),
    href: rows.map((r, i) => (r.v ? `/tenancies/${r.v.tenancy.id}` : `/properties/${units[i].prop.id}`)),
  };
}

/** REP-007: active expenses in a date range; workspace-level ones show "All properties". */
export function expenseReport(p: Portfolio, from: string, to: string, propertyId?: string): Table {
  const list = p.expenses.filter((e) => e.status === "ACTIVE" && e.expenseDate >= from && e.expenseDate <= to
    && (propertyId === undefined || (propertyId === "" ? !e.propertyId : e.propertyId === propertyId)));
  const prop = (id: string | null) => (id ? p.properties.find((x) => x.id === id)?.name : "All properties");
  const unit = (id: string | null) => (id ? p.units.find((x) => x.id === id)?.label : "");
  return {
    columns: [{ label: "Date" }, { label: "Property", wrap: true }, { label: "Room" }, { label: "Category" }, { label: "Payee", wrap: true },
      { label: "Method" }, { label: "Reference" }, { label: "Amount", money: true }, { label: "Note", wrap: true }],
    rows: list.map((e) => [e.expenseDate, prop(e.propertyId), unit(e.unitId), label(EXPENSE_CATEGORIES, e.category), e.payee,
      label(METHODS, e.method), e.reference, m(e.amountMinor, e.currency), e.note]),
  };
}

/** REP-005: one tenancy's rent account with running balance, oldest first (13 §7). */
export function statement(v: TenancyView): Table {
  const rowById = new Map(v.rows.map((r) => [r.id, r]));
  const list = runningBalances(v.entries);
  const cur = v.tenancy.currency;
  return {
    columns: [{ label: "Date" }, { label: "Description", wrap: true }, { label: "Charge", money: true }, { label: "Paid / credit", money: true },
      { label: "Owes", money: true }, { label: "Receipt" }, { label: "Method" }, { label: "Status" }],
    rows: list.map(({ entry: e, running }) => {
      const plus = e.kind === "CHARGE" || e.kind === "REFUND";
      const r = rowById.get(e.id)!;
      return [e.entryDate, e.description, plus ? m(e.amount, cur) : null, plus ? null : m(e.amount, cur), m(running, cur),
        e.receiptNo, label(METHODS, e.method), e.voided ? `VOID: ${r.voidReason ?? ""}` : ""];
    }),
  };
}

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function buildReport(p: Portfolio, type: ReportType, from: string, to: string) {
  if (type === "collections") return collections(p, from, to);
  if (type === "outstanding") return outstanding(p);
  if (type === "deposits") return deposits(p);
  if (type === "expenses") return expenseReport(p, from, to);
  return rentRoll(p);
}

/** Totals per money column, one row per currency (never summed across currencies, 13 §1). */
export function totals(t: Table) {
  const byCur = new Map<string, number[]>();
  for (const row of t.rows)
    row.forEach((c, i) => {
      if (!isMoney(c) || !t.columns[i].money) return;
      const sums = byCur.get(c.currency) ?? t.columns.map(() => 0);
      sums[i] += c.minor;
      byCur.set(c.currency, sums);
    });
  return [...byCur.entries()].map(([currency, sums]) => ({ currency, sums }));
}

/** CSV per 13 §14: UTF-8 with BOM, CRLF, RFC 4180 quoting, money as major-unit decimals plus a currency column. */
export function toCsv(t: Table) {
  const hasMoney = t.columns.some((c) => c.money);
  const q = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const dec = (x: Money) => {
    const d = currencyDigits(x.currency);
    return (x.minor / 10 ** d).toFixed(d);
  };
  const lines = [[...t.columns.map((c) => c.label), ...(hasMoney ? ["Currency"] : [])].map(q).join(",")];
  for (const row of t.rows) {
    const cur = row.find(isMoney)?.currency ?? "";
    lines.push([...row.map((c) => (isMoney(c) ? dec(c) : c == null ? "" : String(c))), ...(hasMoney ? [cur] : [])].map(q).join(","));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";

export function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
