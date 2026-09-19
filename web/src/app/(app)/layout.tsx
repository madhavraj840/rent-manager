import Link from "next/link";
import { Menu, Search, UserRound } from "lucide-react";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/toaster";
import { cloudMode } from "@/db";
import { signOutAction } from "@/app/actions";
import { authUser } from "@/server/auth";
import { requireCtx } from "@/server/queries";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { workspace } = await requireCtx();
  const user = cloudMode() ? await authUser() : null;
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex">
        <Brand name={workspace.name} />
        <div className="mt-5">
          <Nav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
          <details className="relative md:hidden">
            <summary aria-label="Menu" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md hover:bg-surface-2">
              <Menu size={20} aria-hidden />
            </summary>
            <div className="absolute left-0 top-11 w-56 rounded-lg border border-line bg-surface p-2">
              <Nav />
            </div>
          </details>
          <span className="truncate text-sm font-semibold md:hidden">{workspace.name}</span>

          <Link href="/search" aria-label="Search" className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-fg-2 hover:bg-surface-2 sm:hidden">
            <Search size={19} aria-hidden />
          </Link>
          <form action="/search" role="search" className="ml-auto hidden h-9 w-full max-w-xs sm:flex items-center gap-2 rounded-md border border-line bg-bg px-2.5 text-sm text-fg-2 focus-within:outline-2 focus-within:outline-primary">
            <Search size={16} aria-hidden />
            <input name="q" aria-label="Search" placeholder="Search tenants, rooms, receipts" className="w-full min-w-0 bg-transparent text-fg outline-none placeholder:text-fg-2" />
          </form>
          <details className="relative shrink-0">
            <summary aria-label="Account" className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full bg-surface-2 text-fg-2 hover:text-fg">
              <UserRound size={17} aria-hidden />
            </summary>
            <div className="absolute right-0 top-10 w-60 rounded-lg border border-line bg-surface p-3 text-sm">
              <p className="font-medium">{workspace.name}</p>
              <p className="truncate text-fg-2">{user ? `Signed in as ${user.email}` : "On this computer only (no sign-in)"}</p>
              {user && (
                <form action={signOutAction} className="mt-3">
                  <button className="w-full rounded-md border border-line-strong px-3 py-1.5 font-medium hover:bg-surface-2">Sign out</button>
                </form>
              )}
            </div>
          </details>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6">{children}</main>
        <Toaster />
      </div>
    </div>
  );
}

function Brand({ name }: { name: string }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-2.5">
      <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-on-primary">R</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">{name}</span>
        <span className="block text-xs text-fg-2">Rent Manager</span>
      </span>
    </Link>
  );
}
