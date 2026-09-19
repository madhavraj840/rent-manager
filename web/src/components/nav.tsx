"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, LayoutDashboard, Users, Wallet } from "lucide-react";

// Only pages that exist are listed; the rest of 09 §2.2 is added as each screen ships.
const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = path.startsWith(href) || (href === "/properties" && path.startsWith("/tenancies"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium ${
              active ? "bg-primary-soft text-primary" : "text-fg-2 hover:bg-surface-2 hover:text-fg"
            }`}
          >
            <Icon size={17} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
