import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCtx } from "@/server/queries";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Get started" };

// SCR-03 Create workspace (first run)
export default async function SetupPage() {
  if (await getCtx()) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-12 sm:items-center">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-bold text-on-primary">R</span>
          <span className="font-semibold">Rent Manager</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Set up your account</h1>
        <p className="mt-1 text-sm text-fg-2">Your account holds your properties, tenants and money records. Later you can invite co-owners and managers.</p>
        <SetupForm />
      </div>
    </main>
  );
}
