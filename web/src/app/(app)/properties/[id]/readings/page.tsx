import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPortfolio, meterViews } from "@/server/queries";
import { readingContext } from "@/components/meters";
import { Crumbs, PageHeader } from "@/components/ui";
import { RoundForm } from "./round-form";

export const metadata: Metadata = { title: "Enter all readings" };

// SCR-63 Readings round (F-UTIL-3)
export default async function ReadingsRoundPage({ params }: PageProps<"/properties/[id]/readings">) {
  const { id } = await params;
  const p = await loadPortfolio();
  const prop = p.properties.find((x) => x.id === id);
  if (!prop) notFound();
  const rows = meterViews(p, { propertyId: prop.id }).map((mv) => readingContext(mv, p.ctx));
  return (
    <>
      <Crumbs items={[["Properties", "/properties"], [prop.name, `/properties/${prop.id}`], ["Enter all readings"]]} />
      <PageHeader title="Enter all readings" sub="Type the current reading shown on each meter, then save once. Each bill is added to that tenant's balance. Empty rows are skipped." />
      <RoundForm rows={rows} today={p.ctx.today} backHref={`/properties/${prop.id}`} />
    </>
  );
}
