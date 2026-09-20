import type { Metadata } from "next";
import Link from "next/link";
import { loadPortfolio } from "@/server/queries";
import { PutAway } from "@/components/keep-actions";
import { Card, Chevron, Chip, Empty, PageHeader, TenancyStatus, buttonClass, linkClass, money } from "@/components/ui";

export const metadata: Metadata = { title: "Tenants" };

const TABS = [["Current", "/tenants"], ["Former", "/tenants?show=former"], ["Put away", "/tenants?show=away"]] as const;

// SCR-30 Tenant list: Current / Former / Put away
export default async function TenantsPage({ searchParams }: PageProps<"/tenants">) {
  const { show } = await searchParams;
  const tab = show === "former" ? "Former" : show === "away" ? "Put away" : "Current";
  const { tenants, views } = await loadPortfolio();

  const rows = tenants.flatMap((t) => {
    const mine = views.filter((v) => v.people.some((p) => p.id === t.id));
    const cur = mine.find((v) => v.tenancy.status === "ACTIVE");
    const last = [...mine].sort((a, b) => (b.tenancy.movedOutOn ?? "").localeCompare(a.tenancy.movedOutOn ?? ""))[0];
    if (tab === "Put away") return t.archivedAt ? [{ t, v: last }] : [];
    if (t.archivedAt) return [];
    return tab === "Former" ? (cur ? [] : [{ t, v: last }]) : cur ? [{ t, v: cur }] : [];
  });

  const empty = tab === "Put away"
    ? "Nothing here. People you put away leave your lists but keep all their records."
    : tab === "Former" ? "No former tenants yet." : "No tenants yet. Use Add tenant to add the first one.";

  return (
    <>
      <PageHeader
        title="Tenants"
        sub={`${rows.length} ${tab === "Current" ? "current tenants" : tab === "Former" ? "former tenants" : "put away"}`}
        actions={<Link href="/tenancies/new" className={buttonClass.primary}>Add tenant</Link>}
      />
      <nav aria-label="Filter" className="mb-4 inline-flex rounded-md border border-line-strong bg-surface p-0.5 text-sm">
        {TABS.map(([l, href]) => (
          <Link key={l} href={href} aria-current={tab === l ? "page" : undefined}
            className={`rounded px-4 py-1.5 font-medium ${tab === l ? "bg-primary text-on-primary" : "text-fg-2 hover:text-fg"}`}>{l}</Link>
        ))}
      </nav>
      <Card>
        {!rows.length ? (
          <Empty>{empty}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[13px] text-fg-2">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Room</th>
                  <th className="px-4 py-2.5 font-medium max-md:hidden">Phone</th>
                  <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                  <th className="px-4 py-2.5 font-medium max-sm:hidden"><span className="sr-only">Status</span></th>
                  <th className="w-8"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ t, v }) => (
                  <tr key={t.id} className="relative hover:bg-surface-2">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/tenants/${t.id}`} className="after:absolute after:inset-0 hover:underline">{t.fullName}</Link>
                      {tab === "Put away" && <span className="relative ml-2 font-normal"><PutAway kind="TENANT" id={t.id} name={t.fullName} away /></span>}
                    </td>
                    <td className="px-4 py-3">
                      {v ? (
                        <>
                          <Link href={`/tenancies/${v.tenancy.id}`} className={`relative ${linkClass}`}>{v.unit.label}</Link>
                          <div className="text-[13px]"><Link href={`/properties/${v.property.id}`} className={`relative ${linkClass}`}>{v.property.name}</Link></div>
                        </>
                      ) : (
                        <span className="text-fg-2">Not in a room</span>
                      )}
                    </td>
                    <td className="num px-4 py-3 text-fg-2 max-md:hidden">{t.phone}</td>
                    <td className="num px-4 py-3 text-right">{v && v.balance.balance > 0 ? money(v.balance.balance, v.tenancy.currency) : "—"}</td>
                    <td className="px-4 py-3 max-sm:hidden">{v ? <TenancyStatus v={v} /> : <Chip tone="neutral">NO ROOM</Chip>}</td>
                    <td className="pr-3"><Chevron /></td>
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
