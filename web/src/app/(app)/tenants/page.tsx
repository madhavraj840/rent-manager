import type { Metadata } from "next";
import Link from "next/link";
import { loadPortfolio } from "@/server/queries";
import { Card, Empty, PageHeader, TenancyStatus, buttonClass, money } from "@/components/ui";

export const metadata: Metadata = { title: "Tenants" };

// SCR-30 Tenant list: Current / Former
export default async function TenantsPage({ searchParams }: PageProps<"/tenants">) {
  const { show } = await searchParams;
  const former = show === "former";
  const { tenants, views } = await loadPortfolio();
  const rows = tenants.flatMap((t) => {
    const mine = views.filter((v) => v.people.some((p) => p.id === t.id));
    const cur = mine.find((v) => v.tenancy.status === "ACTIVE");
    const v = former ? (cur ? undefined : mine.sort((a, b) => (b.tenancy.movedOutOn ?? "").localeCompare(a.tenancy.movedOutOn ?? ""))[0]) : cur;
    return v ? [{ t, v }] : [];
  });

  return (
    <>
      <PageHeader
        title="Tenants"
        sub={`${rows.length} ${former ? "former" : "current"} tenants`}
        actions={<Link href="/tenancies/new" className={buttonClass.primary}>New tenancy</Link>}
      />
      <nav aria-label="Filter" className="mb-4 inline-flex rounded-md border border-line-strong bg-surface p-0.5 text-sm">
        {[["Current", "/tenants"], ["Former", "/tenants?show=former"]].map(([l, href]) => {
          const active = (l === "Former") === former;
          return (
            <Link key={l} href={href} aria-current={active ? "page" : undefined}
              className={`rounded px-4 py-1.5 font-medium ${active ? "bg-primary text-on-primary" : "text-fg-2 hover:text-fg"}`}>{l}</Link>
          );
        })}
      </nav>
      <Card>
        {!rows.length ? (
          <Empty>{former ? "No former tenants yet." : "No tenants yet. Tenants are added when you start a tenancy."}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[13px] text-fg-2">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                  <th className="px-4 py-2.5 font-medium max-md:hidden">Phone</th>
                  <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                  <th className="px-4 py-2.5 font-medium max-sm:hidden"><span className="sr-only">Status</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ t, v }) => (
                  <tr key={t.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/tenancies/${v.tenancy.id}`} className="hover:underline">{t.fullName}</Link>
                    </td>
                    <td className="px-4 py-3">
                      {v.unit.label}
                      <div className="text-[13px] text-fg-2">{v.property.name}</div>
                    </td>
                    <td className="num px-4 py-3 text-fg-2 max-md:hidden">{t.phone}</td>
                    <td className="num px-4 py-3 text-right">{v.balance.balance > 0 ? money(v.balance.balance, v.tenancy.currency) : "—"}</td>
                    <td className="px-4 py-3 max-sm:hidden"><TenancyStatus v={v} /></td>
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
