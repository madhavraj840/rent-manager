import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { addDays } from "@/lib/money";
import {
  CHARGE_CATEGORIES, CREDIT_CATEGORIES, DOC_CATEGORIES, EXPENSE_CATEGORIES, METER_TYPES, METHODS, PROPERTY_TYPES, RECURRING_CATEGORIES, UNIT_TYPES, UOMS,
} from "@/lib/labels";
import { auditPage, loadPortfolio } from "@/server/queries";
import { isDay } from "@/server/reports";
import { Card, Empty, PageHeader, buttonClass, linkClass, longDate, money } from "@/components/ui";

export const metadata: Metadata = { title: "Change history" };

const control = "h-9 rounded-md border border-line-strong bg-surface px-2.5 font-normal";
const PAGE = 50;

// Plain words for each audited action (C-8).
const ACTIONS: Record<string, string> = {
  "workspace.create": "Created the workspace", "workspace.update": "Changed settings", "rent.generate": "Added this month's rent",
  "property.create": "Added a property", "property.update": "Edited a property", "unit.create_many": "Added rooms",
  "tenancy.start": "Added a tenant", "tenancy.add_existing": "Added a tenant already living there", "tenancy.update_terms": "Edited rent terms",
  "tenancy.notice": "Saved a leaving date", "tenancy.notice_withdraw": "Tenant is staying (leaving date removed)", "settlement.finalize": "Moved a tenant out (final bill)", "tenancy.cancel": "Removed a room record added by mistake",
  "tenant.update": "Edited tenant details", "rent.revise": "Changed rent",
  "payment.record": "Recorded a payment", "charge.add": "Added a charge", "credit.add": "Gave a discount", "ledger.void": "Cancelled an entry", "refund.record": "Gave money back",
  "recurring.add": "Added a charge that repeats every month", "recurring.stop": "Stopped a monthly charge",
  "expense.create": "Added an expense", "expense.update": "Edited an expense", "expense.void": "Cancelled an expense",
  "meter.create": "Added a meter", "meter.update": "Edited a meter", "reading.record": "Entered a meter reading", "reading.void": "Cancelled a meter reading",
  "document.add": "Added a document", "document.delete": "Deleted a document", "document.restore": "Restored a document", "document.view": "Opened a sensitive document",
};

const GROUPS: Record<string, { label: string; prefixes: string[] }> = {
  money: { label: "Payments and charges", prefixes: ["payment.", "charge.", "credit.", "ledger.", "rent.", "refund.", "recurring."] },
  tenancies: { label: "Tenants", prefixes: ["tenancy.", "tenant.", "settlement."] },
  properties: { label: "Properties and rooms", prefixes: ["property.", "unit."] },
  meters: { label: "Meters and readings", prefixes: ["meter.", "reading."] },
  expenses: { label: "Expenses", prefixes: ["expense."] },
  documents: { label: "Documents", prefixes: ["document."] },
};

// ponytail: amounts are stored in minor units under these keys and shown in the workspace currency; fine while one currency is used.
const MONEY_KEYS = /minor$|^amount$|^rent$|^charged$/i;
// Stored codes in plain words (C-8, C-11).
const CODES: Record<string, string> = {
  ...PROPERTY_TYPES, ...UNIT_TYPES, ...METER_TYPES, ...DOC_CATEGORIES, ...CREDIT_CATEGORIES, ...CHARGE_CATEGORIES, ...RECURRING_CATEGORIES, ...EXPENSE_CATEGORIES,
  ...METHODS, ...UOMS,
  CHARGE: "Charge", PAYMENT: "Payment", CREDIT: "Discount", REFUND: "Money given back",
  RENT: "Rent and charges", DEPOSIT: "Security deposit",
  TENANT: "The tenant", LANDLORD: "You", TENANCY: "Tenant record", PROPERTY: "Property", EXPENSE: "Expense",
};
// Field names people understand. Keys that only hold IDs are hidden.
const FIELD_NAMES: Record<string, string> = {
  valueMilli: "reading", oldFinalMilli: "old meter's last reading", newStartMilli: "new meter started at", rateE4: "rate per unit", uom: "measured in",
  label: "name", bill: "bill the tenant", charged: "billed", amountMinor: "amount", rentMinor: "rent", depositMinor: "deposit",
  fixedChargeMinor: "fixed charge", dueDate: "pay by", expenseDate: "date", effectiveFrom: "from", plannedMoveOut: "last day in the room",
  noticeDate: "told on", givenBy: "who decided", graceDays: "days to pay", leaseEndDate: "lease ends", count: "rooms added",
  entityType: "added to", sizeBytes: "size", kind: "type", unit: "room", withdrawn: "leaving date removed", closed: "moved out",
  adjustments: "corrections", charges: "rent charges added", serialNumber: "serial no.", countryCode: "country", addressLine1: "address",
  region: "state", postalCode: "PIN code", fullName: "name", altPhone: "other phone", emergencyName: "emergency contact",
  emergencyPhone: "emergency phone", depositHeldMinor: "deposit already held", openingOwedMinor: "owed from before",
  openingAdvanceMinor: "paid ahead from before", cycleDay: "rent day", billingStart: "rent charged from", startDate: "moved in",
  account: "given back from", startOn: "first month", endOn: "last month", chargesMade: "months charged now", chargesCancelled: "charges crossed out",
  roundToWholeUnits: "round part-month rent", receiptPrefix: "receipt numbers start with", timeZone: "time zone", displayName: "your name",
};
const HIDDEN = /(^id$|Id$|^reading$|^charge$|^settlement$|^receipts$)/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const show = (k: string, v: unknown, cur: string): string =>
  v === null || v === undefined || v === "" ? "—"
    : typeof v === "number" && MONEY_KEYS.test(k) ? money(v, cur)
    : typeof v === "number" && /Milli$/.test(k) ? (v / 1000).toLocaleString("en-IN")
    : typeof v === "number" && k === "rateE4" ? (v / 10_000).toLocaleString("en-IN", { style: "currency", currency: cur })
    : typeof v === "number" && k === "sizeBytes" ? (v < 1024 * 1024 ? `${Math.max(1, Math.round(v / 1024))} KB` : `${(v / 1024 / 1024).toFixed(1)} MB`)
    : typeof v === "boolean" ? (v ? "Yes" : "No")
    : typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? longDate(v)
    : typeof v === "string" && v in CODES ? CODES[v]
    : typeof v === "object" ? JSON.stringify(v) : String(v);
const words = (k: string) => FIELD_NAMES[k] ?? k.replace(/Minor$/, "").replace(/([A-Z])/g, " $1").toLowerCase();
/** One level of nesting is opened up (e.g. a meter replacement), and ID fields are dropped. */
const visible = (o: Record<string, unknown>): [string, unknown][] =>
  Object.entries(o).flatMap(([k, v]) => v && typeof v === "object" && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>) : [[k, v] as [string, unknown]])
    .filter(([k, v]) => !HIDDEN.test(k) && !(typeof v === "string" && UUID.test(v)));

function Changes({ c, cur, uom }: { c: unknown; cur: string; uom?: string }) {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, Record<string, unknown> | unknown>;
  const before = o.before as Record<string, unknown> | undefined;
  const after = o.after as Record<string, unknown> | undefined;
  const lines = before && after && typeof before === "object" && typeof after === "object"
    ? visible(after).filter(([k]) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map(([k]) => [words(k), `${show(k, before[k], cur)} → ${show(k, after[k], cur)}`])
    : visible(o).map(([k, v]) => [words(k), show(k, v, cur) + (uom && /Milli$/.test(k) ? ` ${uom}` : "")]);
  if (!lines.length) return null;
  return (
    <details className="mt-1 text-[13px]">
      <summary className="cursor-pointer text-fg-2 hover:text-fg">Details</summary>
      <dl className="num mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
        {lines.map(([k, v]) => <Fragment key={k}><dt className="text-fg-2">{k}</dt><dd className="break-all">{v}</dd></Fragment>)}
      </dl>
    </details>
  );
}

// SCR-99 Audit log (F-TEAM-4), called "Change history" in the app.
export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const sp = await searchParams;
  const p = await loadPortfolio();
  const { ctx } = p;
  const to = isDay(sp.to) ? sp.to : ctx.today;
  let from = isDay(sp.from) ? sp.from : addDays(to, -30);
  if (from < addDays(to, -366)) from = addDays(to, -366); // at most a year per query (F-TEAM-4)
  const what = typeof sp.what === "string" && sp.what in GROUPS ? sp.what : "all";
  const page = Math.max(0, Number(sp.page) || 0);
  const { rows, more } = await auditPage({ from, to, prefixes: GROUPS[what]?.prefixes, offset: page * PAGE, limit: PAGE });

  // Where each record lives, so the row can link to it (C-1).
  const tenancyTitle = (id: string) => { const v = p.views.find((x) => x.tenancy.id === id); return v && `${v.unit.label} · ${v.people[0]?.fullName ?? ""}`; };
  const entryTenancy = new Map(p.views.flatMap((v) => v.rows.map((r) => [r.id, v.tenancy.id] as const)));
  const record = (type: string, id: string | null): [string, string] | null => {
    if (!id) return null;
    const tid = type === "tenancy" ? id : type === "ledger_entry" ? entryTenancy.get(id) : undefined;
    if (tid) return tenancyTitle(tid) ? [tenancyTitle(tid)!, `/tenancies/${tid}`] : null;
    if (type === "tenant") { const v = p.views.find((x) => x.people.some((pp) => pp.id === id)); return v ? [v.people.find((pp) => pp.id === id)!.fullName, `/tenancies/${v.tenancy.id}`] : null; }
    if (type === "property") { const x = p.properties.find((pp) => pp.id === id); return x ? [x.name, `/properties/${x.id}`] : null; }
    if (type === "meter") { const m = p.meters.find((x) => x.id === id); return m ? [m.label, `/meters/${m.id}`] : null; }
    if (type === "expense") return ["Expenses", "/expenses"];
    return null;
  };
  const time = (at: string) => new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: ctx.workspace.timeZone });
  const day = (at: string) => new Intl.DateTimeFormat("en-CA", { timeZone: ctx.workspace.timeZone }).format(new Date(at));
  const qs = (n: number) => `/history?${new URLSearchParams({ from, to, what, page: String(n) })}`;

  return (
    <>
      <PageHeader title="Change history" sub="Every change made in your account, newest first. Nothing here can be changed or deleted." />

      <form action="/history" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1 font-medium">From<input type="date" name="from" defaultValue={from} max={ctx.today} className={control} /></label>
        <label className="flex flex-col gap-1 font-medium">To<input type="date" name="to" defaultValue={to} max={ctx.today} className={control} /></label>
        <label className="flex flex-col gap-1 font-medium">Show
          <select name="what" defaultValue={what} className={control}>
            <option value="all">Everything</option>
            {Object.entries(GROUPS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}
          </select>
        </label>
        <button className={buttonClass.secondary}>Show</button>
      </form>

      <Card>
        {!rows.length ? <Empty>No changes for these filters. Try a wider date range or Everything.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {rows.map(({ e, who }, i) => {
              const r = record(e.entityType, e.entityId);
              const newDay = i === 0 || day(rows[i - 1].e.at) !== day(e.at);
              return (
                <li key={e.id} className="px-4 py-3">
                  {newDay && <p className="mb-2 text-[13px] font-semibold text-fg-2">{longDate(day(e.at))}</p>}
                  <div className="flex items-baseline gap-3">
                    <span className="num w-16 shrink-0 text-[13px] text-fg-2">{time(e.at)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{ACTIONS[e.action] ?? e.action}</span>
                      {r && <> · <Link href={r[1]} className={linkClass}>{r[0]}</Link></>}
                      <span className="block text-[13px] text-fg-2">{e.actorId ? who ?? "Former member" : "System"} · {e.source === "WEB" ? "Website" : e.source}</span>
                      <Changes c={e.changes} cur={ctx.workspace.defaultCurrency} uom={e.entityType === "meter" ? UOMS[p.meters.find((m) => m.id === e.entityId)?.uom as keyof typeof UOMS] : undefined} />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {(page > 0 || more) && (
        <div className="mt-4 flex justify-between text-sm">
          {page > 0 ? <Link href={qs(page - 1)} className={buttonClass.secondary}>Newer</Link> : <span />}
          {more && <Link href={qs(page + 1)} className={buttonClass.secondary}>Older</Link>}
        </div>
      )}
    </>
  );
}
