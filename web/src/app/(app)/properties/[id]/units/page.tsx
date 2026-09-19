import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPortfolio } from "@/server/queries";
import { Crumbs, PageHeader } from "@/components/ui";
import { UnitsForm } from "./units-form";

export const metadata: Metadata = { title: "Add rooms" };

// SCR-24 Add units
export default async function AddUnitsPage({ params }: PageProps<"/properties/[id]/units">) {
  const { id } = await params;
  const { properties, units } = await loadPortfolio();
  const p = properties.find((x) => x.id === id);
  if (!p) notFound();
  const existing = units.filter((u) => u.propertyId === p.id).map((u) => u.label.toLowerCase());
  return (
    <div className="mx-auto max-w-2xl">
      <Crumbs items={[["Properties", "/properties"], [p.name, `/properties/${p.id}`], ["Add rooms"]]} />
      <PageHeader title="Add rooms" sub="A room is anything you rent out on its own: a room, a flat, a shop or a bed." />
      <UnitsForm propertyId={p.id} currency={p.currency} existing={existing} />
    </div>
  );
}
