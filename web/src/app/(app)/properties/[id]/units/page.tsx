import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPortfolio } from "@/server/queries";
import { PageHeader } from "@/components/ui";
import { UnitsForm } from "./units-form";

export const metadata: Metadata = { title: "Add units" };

// SCR-24 Add units
export default async function AddUnitsPage({ params }: PageProps<"/properties/[id]/units">) {
  const { id } = await params;
  const { properties, units } = await loadPortfolio();
  const p = properties.find((x) => x.id === id);
  if (!p) notFound();
  const existing = units.filter((u) => u.propertyId === p.id).map((u) => u.label.toLowerCase());
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-1 text-sm"><Link href={`/properties/${p.id}`} className="text-fg-2 hover:text-fg">{p.name}</Link></p>
      <PageHeader title="Add units" sub="A unit is anything rented separately: a flat, a room or a bed." />
      <UnitsForm propertyId={p.id} currency={p.currency} existing={existing} />
    </div>
  );
}
