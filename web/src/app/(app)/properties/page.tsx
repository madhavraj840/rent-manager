import type { Metadata } from "next";
import Link from "next/link";
import { loadPortfolio } from "@/server/queries";
import { PROPERTY_TYPES, label } from "@/lib/labels";
import { Card, Empty, PageHeader, buttonClass, money } from "@/components/ui";

export const metadata: Metadata = { title: "Properties" };

// SCR-20 Property list
export default async function PropertiesPage() {
  const { properties, units, current } = await loadPortfolio();
  const rows = properties.map((p) => {
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
      <PageHeader title="Properties" sub={`${properties.length} properties · ${units.length} units`} actions={add} />
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
                  <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-2.5 text-right font-medium max-sm:hidden">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ p, total, occupied, outstanding, overdue }) => (
                  <tr key={p.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/properties/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                      <div className="text-[13px] text-fg-2">{[label(PROPERTY_TYPES, p.type), p.city].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="num">{total ? `${occupied}/${total} occupied` : "No units"}</div>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
