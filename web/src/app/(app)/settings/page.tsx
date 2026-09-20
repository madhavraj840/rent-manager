import type { Metadata } from "next";
import { cloudMode } from "@/db";
import { authUser } from "@/server/auth";
import { requireCtx } from "@/server/queries";
import type { PayTo } from "@/lib/labels";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

// SCR-11 Settings: how your business appears, and how tenants can pay you.
export default async function SettingsPage() {
  const ctx = await requireCtx();
  const user = cloudMode() ? await authUser() : null;
  const w = ctx.workspace;
  return (
    <>
      <PageHeader title="Settings" sub="Your business details, and how tenants can pay you." />
      <SettingsForm
        w={{ name: w.name, timeZone: w.timeZone, receiptPrefix: w.receiptPrefix, roundToWholeUnits: w.roundToWholeUnits, currency: w.defaultCurrency }}
        payTo={(w.paymentInstructions as PayTo | null) ?? {}}
        me={{ name: ctx.userName ?? "", email: user?.email ?? "" }}
      />
    </>
  );
}
