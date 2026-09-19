import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { loadPortfolio } from "@/server/queries";
import { RANGED, REPORTS, buildReport, isDay, type ReportType } from "@/server/reports";
import { DataTable } from "@/components/data-table";
import { Card, PageHeader, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Reports" };

const DESCRIPTIONS: Record<ReportType, string> = {
  collections: "Money received and returned between two dates. Money owed from before you used this app is left out.",
  outstanding: "Who owes money today, grouped by how many days past the due date.",
  deposits: "Deposits are held for tenants and are not income.",
  "rent-roll": "Every room, who lives there and what it earns.",
  expenses: "Money spent on the properties between two dates.",
};

// 13 §3–6, each with CSV export
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const sp = await searchParams;
  const type: ReportType = typeof sp.type === "string" && sp.type in REPORTS ? (sp.type as ReportType) : "collections";
  const p = await loadPortfolio();
  const from = isDay(sp.from) ? sp.from : p.ctx.today.slice(0, 8) + "01";
  const to = isDay(sp.to) ? sp.to : p.ctx.today;
  const table = buildReport(p, type, from, to);
  const ranged = RANGED.includes(type);
  const qs = ranged ? `?from=${from}&to=${to}` : "";

  return (
    <>
      <PageHeader
        title="Reports"
        sub={DESCRIPTIONS[type]}
        actions={<a href={`/export/report/${type}${qs}`} className={buttonClass.secondary}><Download size={16} aria-hidden /> Download CSV</a>}
      />
      <nav aria-label="Reports" className="mb-4 flex flex-wrap gap-1 border-b border-line text-sm">
        {(Object.keys(REPORTS) as ReportType[]).map((k) => (
          <Link key={k} href={`/reports?type=${k}`} aria-current={k === type ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 font-medium ${k === type ? "border-primary text-primary" : "border-transparent text-fg-2 hover:text-fg"}`}>
            {REPORTS[k]}
          </Link>
        ))}
      </nav>
      {ranged && (
        <form action="/reports" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="type" value={type} />
          <label className="flex flex-col gap-1 font-medium">From
            <input type="date" name="from" defaultValue={from} className="h-9 rounded-md border border-line-strong bg-surface px-2.5 font-normal" />
          </label>
          <label className="flex flex-col gap-1 font-medium">To
            <input type="date" name="to" defaultValue={to} className="h-9 rounded-md border border-line-strong bg-surface px-2.5 font-normal" />
          </label>
          <button className={buttonClass.secondary}>Show</button>
        </form>
      )}
      <Card>
        <DataTable table={table} empty={type === "outstanding" ? "Nobody owes anything today." : "Nothing in this report yet."} />
      </Card>
    </>
  );
}
