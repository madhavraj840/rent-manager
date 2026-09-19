import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPortfolio, meterViews } from "@/server/queries";
import { readingContext } from "@/components/meters";
import { PageHeader } from "@/components/ui";
import { RoundForm } from "./round-form";

export const metadata: Metadata = { title: "Readings round" };

// SCR-63 Readings round (F-UTIL-3)
export default async function ReadingsRoundPage({ params }: PageProps<"/properties/[id]/readings">) {
  const { id } = await params;
  const p = await loadPortfolio();
  const prop = p.properties.find((x) => x.id === id);
  if (!prop) notFound();
  const rows = meterViews(p, { propertyId: prop.id }).map((mv) => readingContext(mv, p.ctx));
  return (
    <>
      <p className="mb-1 text-sm"><Link href={`/properties/${prop.id}`} className="text-fg-2 hover:text-fg">{prop.name}</Link></p>
      <PageHeader title="Readings round" sub="Walk the building, type each meter's reading, then save them all. Empty rows are skipped." />
      <RoundForm rows={rows} today={p.ctx.today} backHref={`/properties/${prop.id}`} />
    </>
  );
}
