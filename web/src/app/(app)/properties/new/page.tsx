import type { Metadata } from "next";
import { requireCtx } from "@/server/queries";
import { Crumbs, PageHeader } from "@/components/ui";
import { PropertyForm } from "@/components/property-form";

export const metadata: Metadata = { title: "Add property" };

export default async function NewPropertyPage() {
  const ctx = await requireCtx();
  return (
    <div className="mx-auto max-w-2xl">
      <Crumbs items={[["Properties", "/properties"], ["Add property"]]} />
      <PageHeader title="Add property" sub="You can add its rooms right after." />
      <PropertyForm p={{ countryCode: ctx.workspace.countryCode, currency: ctx.workspace.defaultCurrency }} />
    </div>
  );
}
