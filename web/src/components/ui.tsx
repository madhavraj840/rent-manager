import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { Ctx } from "@/server/commands";
import type { TenancyView } from "@/server/queries";
import { RecordPayment, type PaymentContext } from "./tenancy-actions";

// ponytail: one display locale (en-IN grouping) for now; viewer locale from the profile comes with auth (09 §3.7).
export const LOCALE = "en-IN";

export const money = (minor: number, currency: string) => formatMoney(minor, currency, LOCALE);

export const shortDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00Z").toLocaleDateString(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" }) : "";

export const longDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00Z").toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";

// C-1 (doc 20): the one style for a link inside text.
export const linkClass = "font-medium text-primary underline-offset-2 hover:underline";

// C-2: breadcrumb trail; the last item is the current page.
export function Crumbs({ items }: { items: [label: string, href?: string][] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-1.5 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-fg-2">
        {items.map(([l, href], i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} aria-hidden />}
            {href ? <Link href={href} className={linkClass}>{l}</Link> : <span aria-current="page">{l}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// C-1: chevron that marks a row as "opens a page".
export const Chevron = () => <ChevronRight size={18} aria-hidden className="shrink-0 text-fg-2" />;

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-fg-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-surface ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const chipTone = {
  paid: "bg-primary-soft text-primary",
  due: "bg-due-soft text-due",
  overdue: "bg-overdue-soft text-overdue",
  neutral: "border border-line-strong text-fg-2",
} as const;

export function Chip({ tone, children, label }: { tone: keyof typeof chipTone; children: ReactNode; label?: string }) {
  return (
    <span aria-label={label} className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${chipTone[tone]}`}>
      {children}
    </span>
  );
}

// One status per tenancy, always text + colour (09 §1 principle 4).
export function TenancyStatus({ v }: { v: TenancyView }) {
  const b = v.balance;
  const cur = v.tenancy.currency;
  if (v.tenancy.status === "CLOSED") return <Chip tone="neutral">MOVED OUT</Chip>;
  if (b.overdue > 0) {
    const days = `${b.daysOverdue} ${b.daysOverdue === 1 ? "day" : "days"}`;
    return <Chip tone="overdue" label={`Status: overdue, ${days}`}>OVERDUE · {days}</Chip>;
  }
  if (b.balance > 0) {
    const partly = b.charges.some((c) => c.state === "PARTLY_PAID");
    return partly ? <Chip tone="due">PARTLY PAID · {money(b.balance, cur)} left</Chip> : <Chip tone="neutral">UNPAID</Chip>;
  }
  if (b.balance < 0) return <Chip tone="neutral">ADVANCE {money(b.advance, cur)}</Chip>;
  return <Chip tone="paid">PAID</Chip>;
}

export const buttonClass = {
  primary: "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50",
  secondary: "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-surface-2",
  ghost: "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-fg-2 hover:bg-surface-2 hover:text-fg",
};

// Identical everywhere a tenancy is listed (09 §3.4).
export function TenancyRow({ v, ctx, showRecord = true }: { v: TenancyView; ctx: Ctx; showRecord?: boolean }) {
  const primary = v.people[0];
  const due = Math.max(v.balance.balance, 0);
  return (
    <li className="relative flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-surface-2">
      <Link href={`/tenancies/${v.tenancy.id}`} className="min-w-0 flex-1 after:absolute after:inset-0 max-sm:basis-full">
        <div className="truncate font-medium">
          {v.unit.label} · {primary?.fullName ?? "No tenant"}
          {v.people.length > 1 && <span className="font-normal text-fg-2"> +{v.people.length - 1}</span>}
        </div>
        <div className="truncate text-[13px] text-fg-2">
          {v.property.name}
          {v.nextDue && ` · due ${shortDate(v.nextDue)}`}
        </div>
      </Link>
      <div className="num font-medium max-sm:order-1 max-sm:ml-auto sm:text-right">{due > 0 ? money(due, v.tenancy.currency) : "—"}</div>
      <TenancyStatus v={v} />
      {showRecord && <div className="relative max-sm:order-2"><RecordPayment p={paymentContext(v, ctx)} compact /></div>}
      <Chevron />
    </li>
  );
}

export function paymentContext(v: TenancyView, ctx: Ctx): PaymentContext {
  return {
    tenancyId: v.tenancy.id,
    title: `${v.unit.label} · ${v.people[0]?.fullName ?? ""}`,
    currency: v.tenancy.currency,
    locale: LOCALE,
    today: ctx.today,
    graceDays: v.tenancy.graceDays,
    due: Math.max(v.balance.balance, 0),
    overdue: v.balance.overdue,
    depositDue: Math.max(v.balance.depositDue, 0),
    open: v.balance.charges
      .filter((c) => c.remaining > 0)
      .map((c) => ({ label: c.entry.description, remaining: c.remaining, amount: c.entry.amount })),
  };
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-fg-2">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
