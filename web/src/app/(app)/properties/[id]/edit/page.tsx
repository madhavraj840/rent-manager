import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPortfolio } from "@/server/queries";
import { Crumbs, PageHeader } from "@/components/ui";
import { PropertyForm } from "@/components/property-form";

export const metadata: Metadata = { title: "Edit property" };

export default async function EditPropertyPage({ params }: PageProps<"/properties/[id]/edit">) {
  const { id } = await params;
  const { properties, views } = await loadPortfolio();
  const p = properties.find((x) => x.id === id);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <Crumbs items={[["Properties", "/properties"], [p.name, `/properties/${p.id}`], ["Edit"]]} />
      <PageHeader title="Edit property" />
      <PropertyForm p={p} currencyLocked={views.some((v) => v.property.id === p.id)} />
    </div>
  );
}
