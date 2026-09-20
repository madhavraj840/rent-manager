import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { documentsFor, expensesIn, loadPortfolio, meterViews, monthSummary } from "@/server/queries";
import { DocumentsCard } from "@/components/documents";
import { MetersCard } from "@/components/meters";
import { PROPERTY_TYPES, UNIT_TYPES, label } from "@/lib/labels";
import { Card, Chevron, Chip, Crumbs, Empty, PageHeader, TenancyStatus, buttonClass, linkClass, money, shortDate } from "@/components/ui";
import { DeleteForGood, PutAway } from "@/components/keep-actions";

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
  const allRooms = units.filter((u) => u.propertyId === p.id);
  const pu = allRooms.filter((u) => !u.archivedAt);
  const everLet = new Set(pv.map((v) => v.unit.id));
  const spent = expensesIn(portfolio, ctx.today.slice(0, 7), p.currency, p.id);
  const addUnits = <Link href={`/properties/${p.id}/units`} className={buttonClass.primary}>Add rooms</Link>;

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
          ["Unpaid", money(s.outstanding, p.currency)],
          ["Spent this month", money(spent, p.currency)],
          ["Left after expenses", money(s.collected - spent, p.currency)],
          ["Rooms let", `${current.length} of ${pu.length}`],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <p className="text-[13px] text-fg-2">{k}</p>
            <p className="num mt-0.5 text-lg font-semibold">{v}</p>
          </div>
        ))}
      </div>

      <Card title={`Rooms (${pu.length})`} className="overflow-hidden">
        {!pu.length ? (
          <Empty action={addUnits}>No rooms yet. Add one, or add many at once.</Empty>
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
                        Add tenant
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

      <div className="mt-6">
        <DocumentsCard docs={await documentsFor([{ type: "PROPERTY", ids: [p.id] }])} target={{ entityType: "PROPERTY", entityId: p.id, where: p.name }} />
      </div>

      {allRooms.length > 0 && (
        <details className="mt-6 rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Put rooms away, or delete ones added by mistake</summary>
          <p className="border-t border-line px-4 py-2.5 text-[13px] text-fg-2">
            Putting a room away keeps everything and only hides it from your lists and from &quot;Add tenant&quot;.
            A room can be deleted only while no tenant has ever been in it.
          </p>
          <ul className="divide-y divide-line border-t border-line text-sm">
            {allRooms.map((u) => {
              const let_ = current.some((v) => v.unit.id === u.id);
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                  <span className={u.archivedAt ? "text-fg-2" : ""}>
                    {u.label}
                    <span className="text-[13px] text-fg-2">
                      {" · "}
                      {let_ ? "has a tenant now" : u.archivedAt ? "put away" : everLet.has(u.id) ? "empty, has had tenants" : "empty, never used"}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    {!let_ && <PutAway kind="ROOM" id={u.id} name={u.label} away={!!u.archivedAt} />}
                    {!let_ && !everLet.has(u.id) && <DeleteForGood kind="ROOM" id={u.id} name={u.label} />}
                    {let_ && <span className="text-[13px] text-fg-2">Move the tenant out first</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {past.length > 0 && (
        <Card title="Past tenants" className="mt-6">
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
      <div className="mt-6 flex flex-wrap items-center gap-1 text-[13px] text-fg-2">
        Finished with {p.name}?
        {current.length
          ? " Move its tenants out first, then you can put it away."
          : <><PutAway kind="PROPERTY" id={p.id} name={p.name} away={!!p.archivedAt} />{!pv.length && <DeleteForGood kind="PROPERTY" id={p.id} name={p.name} />}</>}
      </div>
    </>
  );
}
