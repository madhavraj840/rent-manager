import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadPortfolio } from "@/server/queries";
import { settlementPreview } from "@/server/commands";
import { Crumbs, PageHeader, LOCALE, buttonClass } from "@/components/ui";
import { SettlementForm } from "./settlement-form";

export const metadata: Metadata = { title: "Move out" };

// SCR-50 Move-out + SCR-51 Settlement review (utilities and inspection come with meters, M6)
export default async function MoveOutPage({ params, searchParams }: PageProps<"/tenancies/[id]/move-out">) {
  const { id } = await params;
  const { date } = await searchParams;
  const { ctx, views } = await loadPortfolio();
  const v = views.find((x) => x.tenancy.id === id);
  if (!v) notFound();
  if (v.tenancy.status !== "ACTIVE") redirect(`/tenancies/${id}`);

  const pick = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ctx.today;
  const moveOut = pick > ctx.today ? ctx.today : pick < v.tenancy.startDate ? v.tenancy.startDate : pick;
  const p = await settlementPreview(ctx, id, moveOut);

  return (
    <div className="mx-auto max-w-2xl">
      <Crumbs items={[["Properties", "/properties"], [v.property.name, `/properties/${v.property.id}`], [`${v.unit.label} · ${v.people[0]?.fullName ?? ""}`, `/tenancies/${id}`], ["Move out"]]} />
      <PageHeader title="Move out" sub="Check the final bill, then finish. Anything the tenant still owes is taken from the deposit first." />

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5">
        <div>
          <label htmlFor="date" className="mb-1.5 block text-sm font-medium">Last day in the room</label>
          <input id="date" type="date" name="date" defaultValue={moveOut} min={v.tenancy.startDate} max={ctx.today}
            className="h-10 rounded-md border border-line-strong bg-surface px-3" />
        </div>
        <button className={buttonClass.secondary}>Update amounts</button>
      </form>

      <SettlementForm
        tenancyId={id}
        moveOut={moveOut}
        today={ctx.today}
        currency={v.tenancy.currency}
        locale={LOCALE}
        balanceBefore={p.balanceBefore}
        base={p.balanceAfterLines}
        depositHeld={p.depositHeld}
        voids={p.voids.map((r) => ({ description: r.description ?? "Rent", amount: r.amountMinor }))}
        proration={p.proration.map((x) => ({ description: x.description, amount: x.credit }))}
      />
    </div>
  );
}
