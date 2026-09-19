import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPortfolio } from "@/server/queries";
import { PageHeader } from "@/components/ui";
import { PropertyForm } from "@/components/property-form";

export const metadata: Metadata = { title: "Edit property" };

export default async function EditPropertyPage({ params }: PageProps<"/properties/[id]/edit">) {
  const { id } = await params;
  const { properties, views } = await loadPortfolio();
  const p = properties.find((x) => x.id === id);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-1 text-sm"><Link href={`/properties/${p.id}`} className="text-fg-2 hover:text-fg">{p.name}</Link></p>
      <PageHeader title="Edit property" />
      <PropertyForm p={p} currencyLocked={views.some((v) => v.property.id === p.id)} />
    </div>
  );
}
