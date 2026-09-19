import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { expensesIn, loadPortfolio, meterViews, monthSummary } from "@/server/queries";
import { MetersCard } from "@/components/meters";
import { PROPERTY_TYPES, UNIT_TYPES, label } from "@/lib/labels";
import { Card, Chevron, Chip, Crumbs, Empty, PageHeader, TenancyStatus, buttonClass, linkClass, money, shortDate } from "@/components/ui";

export const metadata: Metadata = { title: "Property" };

// SCR-21 Property detail
export default async function PropertyPage({ params }: PageProps<"/properties/[id]">) {
  const { id } = await params;
  const portfolio = await loadPortfolio();
  const { ctx, properties, units, views } = portfolio;
  const p = properties.find((x) => x.id === id);
  if (!p) notFound();
  const pv = views.filter((v) => v.property.id === p.id);
  const current = pv.filter((v) => v.tenancy.status === "ACTIVE");
  const past = pv.filter((v) => v.tenancy.status !== "ACTIVE");
  const s = monthSummary(current, ctx.today.slice(0, 7));
  const pu = units.filter((u) => u.propertyId === p.id);
  const spent = expensesIn(portfolio, ctx.today.slice(0, 7), p.currency, p.id);
  const addUnits = <Link href={`/properties/${p.id}/units`} className={buttonClass.primary}>Add units</Link>;

  return (
    <>
      <Crumbs items={[["Properties", "/properties"], [p.name]]} />
      <PageHeader
        title={p.name}
        sub={[label(PROPERTY_TYPES, p.type), [p.addressLine1, p.city].filter(Boolean).join(", "), p.currency].filter(Boolean).join(" · ")}
        actions={<><Link href={`/expenses?property=${p.id}`} className={buttonClass.secondary}>Expenses</Link><Link href={`/properties/${p.id}/edit`} className={buttonClass.secondary}>Edit</Link>{addUnits}</>}
      />

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Due this month", money(s.billed, p.currency)],
          ["Collected this month", money(s.collected, p.currency)],
          ["Outstanding", money(s.outstanding, p.currency)],
          ["Spent this month", money(spent, p.currency)],
          ["Net this month", money(s.collected - spent, p.currency)],
          ["Occupied", `${current.length} of ${pu.length}`],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <p className="text-[13px] text-fg-2">{k}</p>
            <p className="num mt-0.5 text-lg font-semibold">{v}</p>
          </div>
        ))}
      </div>

      <Card title={`Units (${pu.length})`} className="overflow-hidden">
        {!pu.length ? (
          <Empty action={addUnits}>No units yet. Add one, or add many at once.</Empty>
        ) : (
          <ul className="-mb-px -mr-px grid sm:grid-cols-2 lg:grid-cols-3">
            {pu.map((u) => {
              const v = current.find((x) => x.unit.id === u.id);
              return (
                <li key={u.id} className="border-b border-r border-line">
                  {v ? (
                    <Link href={`/tenancies/${v.tenancy.id}`} className="block px-4 py-3 hover:bg-surface-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{u.label}</span>
                        <TenancyStatus v={v} />
                      </div>
                      <p className="mt-1 truncate text-[13px] text-fg-2">{v.people.map((x) => x.fullName).join(", ")}</p>
                      <p className="num mt-0.5 flex items-center justify-between text-[13px] text-fg-2">Rent {money(v.rent, p.currency)}<Chevron /></p>
                    </Link>
                  ) : (
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{u.label}</span>
                        <Chip tone="neutral">VACANT</Chip>
                      </div>
                      <p className="mt-1 text-[13px] text-fg-2">
                        {label(UNIT_TYPES, u.type)}{u.defaultRentMinor ? ` · asking ${money(u.defaultRentMinor, p.currency)}` : ""}
                      </p>
                      <Link href={`/tenancies/new?unit=${u.id}`} className={`mt-1.5 inline-block text-[13px] ${linkClass}`}>
                        Start tenancy
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="mt-6">
        <MetersCard list={meterViews(portfolio, { propertyId: p.id })} ctx={ctx} property={p} units={pu} roundHref={`/properties/${p.id}/readings`} />
      </div>

      {past.length > 0 && (
        <Card title="Past tenancies" className="mt-6">
          <ul className="divide-y divide-line text-sm">
            {past.map((v) => (
              <li key={v.tenancy.id}>
                <Link href={`/tenancies/${v.tenancy.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface-2">
                  <span>
                    <span className="font-medium">{v.unit.label} · {v.people[0]?.fullName}</span>
                    <span className="block text-[13px] text-fg-2">{shortDate(v.tenancy.startDate)} – {shortDate(v.tenancy.movedOutOn)}</span>
                  </span>
                  <span className="flex items-center gap-2"><TenancyStatus v={v} /><Chevron /></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
