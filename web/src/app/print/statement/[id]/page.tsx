import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPortfolio } from "@/server/queries";
import { statement } from "@/server/reports";
import { DataTable } from "@/components/data-table";
import { longDate, money } from "@/components/ui";

export const metadata: Metadata = { title: "Statement" };

// REP-005 Tenant statement (13 §7)
export default async function StatementPage({ params }: PageProps<"/print/statement/[id]">) {
  const { id } = await params;
  const { ctx, views } = await loadPortfolio();
  const v = views.find((x) => x.tenancy.id === id);
  if (!v) notFound();
  const tn = v.tenancy;
  const cur = tn.currency;
  const b = v.balance;
  const act = v.rows.filter((r) => r.status === "ACTIVE");
  const sum = (kind: string, account = "DEPOSIT") => act.filter((r) => r.kind === kind && r.account === account).reduce((s, r) => s + r.amountMinor, 0);
  const deposit: [string, number][] = [
    ["Agreed", sum("CHARGE") - sum("CREDIT")],
    ["Received", sum("PAYMENT")],
    ["Used for dues", sum("DEPOSIT_APPLIED", "RENT")],
    ["Returned", sum("REFUND")],
    ["Held now", b.depositHeld],
  ];

  return (
    <article>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-xl font-semibold">Statement of account</h1>
          <p className="text-sm text-fg-2">{ctx.workspace.name}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{v.people.map((p) => p.fullName).join(", ")}</p>
          <p className="text-fg-2">{v.unit.label}, {v.property.name}</p>
          <p className="num text-fg-2">From {longDate(tn.startDate)} to {longDate(tn.movedOutOn ?? ctx.today)}</p>
        </div>
      </header>

      <div className="num my-5 flex flex-wrap gap-x-10 gap-y-2 text-sm">
        <p><span className="block text-fg-2">Balance</span><span className="text-lg font-semibold">{b.balance < 0 ? `Advance ${money(-b.balance, cur)}` : money(b.balance, cur)}</span></p>
        <p><span className="block text-fg-2">Overdue</span><span className="text-lg font-semibold">{money(b.overdue, cur)}</span></p>
        <p><span className="block text-fg-2">Deposit held</span><span className="text-lg font-semibold">{money(b.depositHeld, cur)}</span></p>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Rent and charges</h2>
      <div className="-mx-4 print:mx-0">
        <DataTable table={statement(v)} total={false} empty="No entries." />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Deposit</h2>
      <dl className="num grid max-w-xs grid-cols-2 gap-y-1 text-sm">
        {deposit.map(([k, val]) => (
          <div key={k} className="contents">
            <dt className="text-fg-2">{k}</dt>
            <dd className="text-right">{money(val, cur)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-xs text-fg-2">Generated on {longDate(ctx.today)}. Voided entries are marked VOID and do not count in any balance.</p>
    </article>
  );
}
