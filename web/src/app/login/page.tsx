import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cloudMode } from "@/db";
import { authUser } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

// SCR-01 Sign in with an emailed code. Local mode has no sign-in.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!cloudMode() || (await authUser())) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-12 sm:items-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-bold text-on-primary">R</span>
          <span className="font-semibold">Rent Manager</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-fg-2">Enter your email. We email you a sign-in link. No password needed.</p>
        <LoginForm linkFailed={(await searchParams).link === "failed"} google={process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === "on"} />
      </div>
    </main>
  );
}
