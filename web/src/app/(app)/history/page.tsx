import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { addDays } from "@/lib/money";
import { CHARGE_CATEGORIES, CREDIT_CATEGORIES, DOC_CATEGORIES, EXPENSE_CATEGORIES, METER_TYPES, METHODS, PROPERTY_TYPES, UNIT_TYPES } from "@/lib/labels";
import { auditPage, loadPortfolio } from "@/server/queries";
import { isDay } from "@/server/reports";
import { Card, Empty, PageHeader, buttonClass, linkClass, longDate, money } from "@/components/ui";

export const metadata: Metadata = { title: "Change history" };

const control = "h-9 rounded-md border border-line-strong bg-surface px-2.5 font-normal";
const PAGE = 50;

// Plain words for each audited action (C-8).
const ACTIONS: Record<string, string> = {
  "workspace.create": "Created the workspace", "rent.generate": "Added this month's rent",
  "property.create": "Added a property", "property.update": "Edited a property", "unit.create_many": "Added units",
  "tenancy.start": "Started a tenancy", "tenancy.add_existing": "Added an existing tenancy", "tenancy.update_terms": "Edited tenancy terms",
  "tenancy.notice": "Recorded notice to leave", "tenancy.notice_withdraw": "Withdrew notice", "settlement.finalize": "Moved out and settled",
  "tenant.update": "Edited tenant details", "rent.revise": "Changed rent",
  "payment.record": "Recorded a payment", "charge.add": "Added a charge", "credit.add": "Gave a discount", "ledger.void": "Voided an entry",
  "expense.create": "Added an expense", "expense.update": "Edited an expense", "expense.void": "Voided an expense",
  "meter.create": "Added a meter", "meter.update": "Edited a meter", "reading.record": "Entered a meter reading", "reading.void": "Voided a meter reading",
  "document.add": "Added a document", "document.delete": "Deleted a document", "document.restore": "Restored a document", "document.view": "Opened a sensitive document",
};

const GROUPS: Record<string, { label: string; prefixes: string[] }> = {
  money: { label: "Payments and charges", prefixes: ["payment.", "charge.", "credit.", "ledger.", "rent."] },
  tenancies: { label: "Tenancies and tenants", prefixes: ["tenancy.", "tenant.", "settlement."] },
  properties: { label: "Properties and units", prefixes: ["property.", "unit."] },
  meters: { label: "Meters and readings", prefixes: ["meter.", "reading."] },
  expenses: { label: "Expenses", prefixes: ["expense."] },
  documents: { label: "Documents", prefixes: ["document."] },
};

// ponytail: amounts are stored in minor units under these keys and shown in the workspace currency; fine while one currency is used.
const MONEY_KEYS = /minor$|^amount$|^rent$|^charged$/i;
// Stored codes and dates in plain words (C-8).
const CODES: Record<string, string> = { ...PROPERTY_TYPES, ...UNIT_TYPES, ...METER_TYPES, ...DOC_CATEGORIES, ...CREDIT_CATEGORIES, ...CHARGE_CATEGORIES, ...EXPENSE_CATEGORIES, ...METHODS };
const show = (k: string, v: unknown, cur: string): string =>
  v === null || v === undefined || v === "" ? "—"
    : typeof v === "number" && MONEY_KEYS.test(k) ? money(v, cur)
    : typeof v === "boolean" ? (v ? "Yes" : "No")
    : typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? longDate(v)
    : typeof v === "string" && v in CODES ? CODES[v]
    : typeof v === "object" ? JSON.stringify(v) : String(v);
const words = (k: string) => k.replace(/Minor$/, "").replace(/([A-Z])/g, " $1").toLowerCase();

function Changes({ c, cur }: { c: unknown; cur: string }) {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, Record<string, unknown> | unknown>;
  const before = o.before as Record<string, unknown> | undefined;
  const after = o.after as Record<string, unknown> | undefined;
  const lines = before && after && typeof before === "object" && typeof after === "object"
    ? Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map((k) => [words(k), `${show(k, before[k], cur)} → ${show(k, after[k], cur)}`])
    : Object.entries(o).map(([k, v]) => [words(k), show(k, v, cur)]);
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
      <PageHeader title="Change history" sub="Every change made in this workspace, newest first. Nothing here can be edited or deleted." />

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
                      <Changes c={e.changes} cur={ctx.workspace.defaultCurrency} />
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
