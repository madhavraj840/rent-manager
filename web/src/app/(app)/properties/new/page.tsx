import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/server/queries";
import { PageHeader } from "@/components/ui";
import { PropertyForm } from "@/components/property-form";

export const metadata: Metadata = { title: "Add property" };

export default async function NewPropertyPage() {
  const ctx = await requireCtx();
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-1 text-sm"><Link href="/properties" className="text-fg-2 hover:text-fg">Properties</Link></p>
      <PageHeader title="Add property" sub="You can add its units right after." />
      <PropertyForm p={{ countryCode: ctx.workspace.countryCode, currency: ctx.workspace.defaultCurrency }} />
    </div>
  );
}
