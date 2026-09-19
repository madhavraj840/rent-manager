import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { METHODS, label } from "@/lib/labels";
import { loadPortfolio } from "@/server/queries";
import { longDate, money } from "@/components/ui";

export const metadata: Metadata = { title: "Receipt" };

// Payment receipt (13 §1: PDF via the browser's print dialog)
export default async function ReceiptPage({ params }: PageProps<"/print/receipt/[id]">) {
  const { id } = await params;
  const { ctx, views } = await loadPortfolio();
  const v = views.find((x) => x.rows.some((r) => r.id === id));
  const r = v?.rows.find((x) => x.id === id);
  if (!v || !r?.receiptNumber) notFound();
  const cur = r.currency;
  const void_ = r.status === "VOID";
  const people = v.people.map((p) => p.fullName).join(", ");
  const rows: [string, string | null | undefined][] = [
    ["Received from", people],
    ["Amount", money(r.amountMinor, cur)],
    ["For", r.account === "DEPOSIT" ? "Security deposit" : "Rent and charges"],
    ["Unit", `${v.unit.label}, ${v.property.name}`],
    ["Date received", longDate(r.entryDate)],
    ["Method", label(METHODS, r.method)],
    ["Reference", r.reference],
    ["Note", r.note],
  ];

  return (
    <article className="relative">
      {void_ && (
        <p className="mb-6 rounded-md border-2 border-overdue px-4 py-2 text-center font-semibold text-overdue">
          CANCELLED · {r.voidReason}. This receipt is no longer valid.
        </p>
      )}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-xl font-semibold">{ctx.workspace.name}</h1>
          <p className="text-sm text-fg-2">{v.property.name}{v.property.city && `, ${v.property.city}`}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold uppercase tracking-wide text-fg-2">Receipt</p>
          <p className="num text-lg font-semibold">{r.receiptNumber}</p>
        </div>
      </header>
      <dl className="num grid grid-cols-[10rem_1fr] gap-y-2.5 py-6 text-[15px]">
        {rows.filter(([, val]) => val).map(([k, val]) => (
          <div key={k} className="contents">
            <dt className="text-fg-2">{k}</dt>
            <dd className={k === "Amount" ? "text-lg font-semibold" : ""}>{val}</dd>
          </div>
        ))}
      </dl>
      <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-5 text-sm text-fg-2">
        <p>Thank you.</p>
        <p className="text-right">
          <span className="block h-10" />
          Received by {ctx.userName ?? ctx.workspace.name}
        </p>
      </footer>
    </article>
  );
}
