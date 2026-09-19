import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { addDays } from "@/lib/money";
import { loadSample } from "@/app/actions";
import { expensesIn, loadPortfolio, monthSummary } from "@/server/queries";
import { Card, Empty, PageHeader, TenancyRow, buttonClass, longDate, money, shortDate } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

// SCR-10 Home / Dashboard (09 §4, 13 §2)
export default async function DashboardPage() {
  const p = await loadPortfolio();
  const { ctx, properties, units, current } = p;
  if (!current.length) return <Onboarding hasProperty={properties.length > 0} hasUnits={units.length > 0} />;

  const ym = ctx.today.slice(0, 7);
  const month = new Date(ctx.today + "T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const home = ctx.workspace.defaultCurrency;
  const currencies = [...new Set(current.map((v) => v.tenancy.currency))].sort((a, b) => (a === home ? -1 : b === home ? 1 : a.localeCompare(b)));

  const attention = current.filter((v) => v.balance.overdue > 0).sort((a, b) => b.balance.daysOverdue - a.balance.daysOverdue);
  const dueSoon = current.filter((v) => v.balance.overdue === 0 && v.balance.dueSoon > 0);
  const paid = current.filter((v) => v.balance.balance <= 0);
  const in30 = addDays(ctx.today, 30);
  const leases = current.filter((v) => v.tenancy.leaseEndDate && v.tenancy.leaseEndDate <= in30);
  const depositsShort = current.filter((v) => v.balance.depositDue > 0);
  const leaving = current.filter((v) => v.tenancy.plannedMoveOutDate && v.tenancy.plannedMoveOutDate <= in30)
    .sort((a, b) => a.tenancy.plannedMoveOutDate!.localeCompare(b.tenancy.plannedMoveOutDate!));

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub={`${month} · ${current.length} of ${units.length} units occupied`}
        actions={<Link href="/tenancies/new" className={buttonClass.secondary}>New tenancy</Link>}
      />

      {/* Amounts in different currencies are never added together (10 §17). */}
      {currencies.map((cur) => {
        const mine = current.filter((v) => v.tenancy.currency === cur);
        const s = monthSummary(mine, ym);
        const pct = s.billed ? Math.min(100, Math.round((s.collected / s.billed) * 100)) : 0;
        const overdueCount = mine.filter((v) => v.balance.overdue > 0).length;
        const spent = expensesIn(p, ym, cur);
        return (
          <div key={cur} className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label={`Collected this month${currencies.length > 1 ? ` · ${cur}` : ""}`} value={money(s.collected, cur)}>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Collected of billed">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="num mt-1.5 text-[13px] text-fg-2">{pct}% of {money(s.billed, cur)} due this month</p>
            </Stat>
            <Stat label="Outstanding" value={money(s.outstanding, cur)}>
              <p className="mt-1.5 text-[13px] text-fg-2">All unpaid charges, any month</p>
            </Stat>
            <Stat label="Overdue" value={money(s.overdue, cur)} tone={s.overdue > 0 ? "text-overdue" : undefined}>
              <p className="mt-1.5 text-[13px] text-fg-2">{overdueCount} {overdueCount === 1 ? "tenancy" : "tenancies"} past due date</p>
            </Stat>
            <Stat label="Deposits held" value={money(s.depositsHeld, cur)}>
              <p className="mt-1.5 text-[13px] text-fg-2">Refundable at move-out</p>
            </Stat>
            <Stat label="Net this month" value={money(s.collected - spent, cur)} tone={s.collected - spent < 0 ? "text-overdue" : undefined}>
              <p className="num mt-1.5 text-[13px] text-fg-2"><Link href="/expenses" className="hover:underline">{money(spent, cur)} spent</Link></p>
            </Stat>
          </div>
        );
      })}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Card title={`Needs attention (${attention.length})`}>
            {attention.length ? (
              <ul className="divide-y divide-line">{attention.map((v) => <TenancyRow key={v.tenancy.id} v={v} ctx={ctx} />)}</ul>
            ) : (
              <Empty>Nothing overdue.</Empty>
            )}
          </Card>

          <Card title={`Due in the next 7 days (${dueSoon.length})`}>
            {dueSoon.length ? (
              <ul className="divide-y divide-line">{dueSoon.map((v) => <TenancyRow key={v.tenancy.id} v={v} ctx={ctx} />)}</ul>
            ) : (
              <Empty>No rent falls due in the next 7 days.</Empty>
            )}
          </Card>

          <Card>
            <details>
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">Paid up ({paid.length})</summary>
              <ul className="divide-y divide-line border-t border-line">
                {paid.map((v) => <TenancyRow key={v.tenancy.id} v={v} ctx={ctx} showRecord={false} />)}
              </ul>
            </details>
          </Card>
        </div>

        <Card title="Coming up" className="self-start">
          <ul className="divide-y divide-line text-sm">
            {leaving.map((v) => (
              <li key={v.tenancy.id}>
                <Link href={`/tenancies/${v.tenancy.id}`} className="block px-4 py-3 hover:bg-surface-2">
                  <p className="font-medium">{v.tenancy.plannedMoveOutDate! < ctx.today ? "Should have moved out" : "Moving out"} {longDate(v.tenancy.plannedMoveOutDate)}</p>
                  <p className="text-[13px] text-fg-2">{v.unit.label} · {v.people[0]?.fullName}</p>
                </Link>
              </li>
            ))}
            {leases.filter((v) => !v.tenancy.plannedMoveOutDate).map((v) => (
              <li key={v.tenancy.id}>
                <Link href={`/tenancies/${v.tenancy.id}`} className="block px-4 py-3 hover:bg-surface-2">
                  <p className="font-medium">Lease {v.tenancy.leaseEndDate! < ctx.today ? "ended" : "ends"} {longDate(v.tenancy.leaseEndDate)}</p>
                  <p className="text-[13px] text-fg-2">{v.unit.label} · {v.people[0]?.fullName}</p>
                </Link>
              </li>
            ))}
            {depositsShort.map((v) => (
              <li key={v.tenancy.id}>
                <Link href={`/tenancies/${v.tenancy.id}`} className="block px-4 py-3 hover:bg-surface-2">
                  <p className="num font-medium">Deposit short by {money(v.balance.depositDue, v.tenancy.currency)}</p>
                  <p className="text-[13px] text-fg-2">{v.unit.label} · {v.people[0]?.fullName} · since {shortDate(v.tenancy.startDate)}</p>
                </Link>
              </li>
            ))}
            {!leases.length && !depositsShort.length && !leaving.length && <li className="px-4 py-6 text-fg-2">Nothing in the next 30 days.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}

// SCR-06 Onboarding checklist (Home empty state)
function Onboarding({ hasProperty, hasUnits }: { hasProperty: boolean; hasUnits: boolean }) {
  const steps = [
    { done: hasProperty, title: "Add a property", text: "A building, house or PG you rent out.", href: "/properties/new", cta: "Add property" },
    { done: hasUnits, title: "Add units", text: "Flats, rooms or beds, one at a time or many at once.", href: "/properties", cta: "Go to properties" },
    { done: false, title: "Add a tenancy", text: "A new tenant moving in, or someone already living there.", href: "/tenancies/new", cta: "New tenancy" },
  ];
  const next = steps.findIndex((s) => !s.done);
  return (
    <>
      <PageHeader title="Welcome" sub="Three steps and your rent records are live." />
      <Card>
        <ol className="divide-y divide-line">
          {steps.map((s, i) => (
            <li key={s.title} className="flex flex-wrap items-center gap-4 px-4 py-4">
              <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${s.done ? "bg-primary text-on-primary" : "border border-line-strong text-fg-2"}`}>
                {s.done ? <Check size={16} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.title}{s.done && <span className="sr-only"> (done)</span>}</p>
                <p className="text-sm text-fg-2">{s.text}</p>
              </div>
              {!s.done && <Link href={s.href} className={i === next ? buttonClass.primary : buttonClass.secondary}>{s.cta}</Link>}
            </li>
          ))}
        </ol>
      </Card>
      {!hasProperty && (
        <Card className="mt-6">
          <form action={loadSample} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <p className="font-medium">Just looking around?</p>
              <p className="text-sm text-fg-2">Fill this workspace with 3 sample properties and 10 tenancies to try every screen.</p>
            </div>
            <button className={buttonClass.secondary}>Load sample data</button>
          </form>
        </Card>
      )}
    </>
  );
}

function Stat({ label, value, tone, children }: { label: string; value: string; tone?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3.5">
      <p className="text-[13px] font-medium text-fg-2">{label}</p>
      <p className={`num mt-1 text-2xl font-semibold tracking-tight ${tone ?? ""}`}>{value}</p>
      {children}
    </div>
  );
}
