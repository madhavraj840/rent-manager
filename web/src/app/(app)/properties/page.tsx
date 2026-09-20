import type { Metadata } from "next";
import Link from "next/link";
import { loadPortfolio } from "@/server/queries";
import { PROPERTY_TYPES, label } from "@/lib/labels";
import { Card, Chevron, Empty, PageHeader, buttonClass, money } from "@/components/ui";
import { PutAway } from "@/components/keep-actions";

export const metadata: Metadata = { title: "Properties" };

// SCR-20 Property list
export default async function PropertiesPage() {
  const { properties, units, current } = await loadPortfolio();
  const away = properties.filter((p) => p.archivedAt);
  const rows = properties.filter((p) => !p.archivedAt).map((p) => {
    const pv = current.filter((v) => v.property.id === p.id);
    return {
      p,
      total: units.filter((u) => u.propertyId === p.id).length,
      occupied: pv.length,
      outstanding: pv.reduce((s, v) => s + Math.max(v.balance.balance, 0), 0),
      overdue: pv.reduce((s, v) => s + v.balance.overdue, 0),
    };
  });
  const add = <Link href="/properties/new" className={buttonClass.primary}>Add property</Link>;

  return (
    <>
      <PageHeader title="Properties" sub={`${rows.length} properties · ${units.filter((u) => !u.archivedAt).length} rooms`} actions={add} />
      <Card>
        {!rows.length ? (
          <Empty action={add}>No properties yet. Add your first building or house.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[13px] text-fg-2">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Property</th>
                  <th className="px-4 py-2.5 font-medium">Occupancy</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unpaid</th>
                  <th className="px-4 py-2.5 text-right font-medium max-sm:hidden">Overdue</th>
                  <th className="w-8"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ p, total, occupied, outstanding, overdue }) => (
                  <tr key={p.id} className="relative hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/properties/${p.id}`} className="font-medium after:absolute after:inset-0 hover:underline">{p.name}</Link>
                      <div className="text-[13px] text-fg-2">{[label(PROPERTY_TYPES, p.type), p.city].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="num">{total ? `${occupied} of ${total} rooms let` : "No rooms yet"}</div>
                      {total > 0 && (
                        <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full bg-primary" style={{ width: `${(occupied / total) * 100}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="num px-4 py-3 text-right">{money(outstanding, p.currency)}</td>
                    <td className={`num px-4 py-3 text-right max-sm:hidden ${overdue > 0 ? "font-medium text-overdue" : "text-fg-2"}`}>
                      {overdue > 0 ? money(overdue, p.currency) : "—"}
                    </td>
                    <td className="pr-3"><Chevron /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {away.length > 0 && (
        <Card title={`Put away (${away.length})`} className="mt-6">
          <p className="border-b border-line px-4 py-2.5 text-[13px] text-fg-2">
            These are out of your everyday lists. Nothing has been deleted. Bring one back to use it again.
          </p>
          <ul className="divide-y divide-line text-sm">
            {away.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <Link href={`/properties/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                <span className="text-[13px] text-fg-2">
                  {units.filter((u) => u.propertyId === p.id).length} rooms
                  {" "}<PutAway kind="PROPERTY" id={p.id} name={p.name} away />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
