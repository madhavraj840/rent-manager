import type { Metadata } from "next";
import Link from "next/link";
import { loadPortfolio } from "@/server/queries";
import { Card, Empty, PageHeader, buttonClass } from "@/components/ui";
import { TenancyForm } from "./tenancy-form";

export const metadata: Metadata = { title: "New tenancy" };

// SCR-40 New tenancy + SCR-41 Existing tenancy (one form)
export default async function NewTenancyPage({ searchParams }: PageProps<"/tenancies/new">) {
  const { unit } = await searchParams;
  const { ctx, properties, units, tenants, current } = await loadPortfolio();
  const occupied = new Set(current.map((v) => v.unit.id));
  const propById = new Map(properties.map((p) => [p.id, p]));
  const options = units
    .filter((u) => !u.archivedAt && propById.get(u.propertyId))
    .map((u) => {
      const p = propById.get(u.propertyId)!;
      return { id: u.id, label: u.label, property: p.name, currency: p.currency, rent: u.defaultRentMinor ?? 0, deposit: u.defaultDepositMinor ?? 0, occupied: occupied.has(u.id) };
    })
    .sort((a, b) => a.property.localeCompare(b.property) || Number(a.occupied) - Number(b.occupied) || a.label.localeCompare(b.label, undefined, { numeric: true }));

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-1 text-sm"><Link href="/dashboard" className="text-fg-2 hover:text-fg">Dashboard</Link></p>
      <PageHeader title="New tenancy" sub="Who is renting which unit, for how much, from when." />
      {!options.length ? (
        <Card>
          <Empty action={<Link href="/properties" className={buttonClass.primary}>Go to properties</Link>}>Add a property and its units first.</Empty>
        </Card>
      ) : (
        <TenancyForm
          units={options}
          tenants={tenants.filter((x) => !x.archivedAt).map((x) => ({ id: x.id, name: x.fullName, phone: x.phone ?? "" }))}
          today={ctx.today}
          roundWhole={ctx.workspace.roundToWholeUnits}
          initialUnit={typeof unit === "string" && options.some((o) => o.id === unit) ? unit : options.find((o) => !o.occupied)?.id ?? options[0].id}
        />
      )}
    </div>
  );
}
