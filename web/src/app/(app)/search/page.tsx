import type { Metadata } from "next";
import Link from "next/link";
import { loadPortfolio } from "@/server/queries";
import { Card, PageHeader, money, shortDate } from "@/components/ui";

export const metadata: Metadata = { title: "Search" };

// SCR-86 Search: tenants, units, properties, receipts
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q: raw } = await searchParams;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, 100);
  const { properties, units, tenants, views } = await loadPortfolio();
  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  const has = (s?: string | null) => !!s && s.toLowerCase().includes(needle);

  const tenantHits = q ? tenants.filter((t) => has(t.fullName) || has(t.email) || (digits.length >= 4 && (t.phone ?? "").replace(/\D/g, "").includes(digits))) : [];
  const unitHits = q ? units.filter((u) => has(u.label)) : [];
  const propHits = q ? properties.filter((p) => has(p.name) || has(p.city) || has(p.addressLine1)) : [];
  const receiptHits = q ? views.flatMap((v) => v.rows.filter((r) => has(r.receiptNumber) || has(r.reference)).map((r) => ({ r, v }))) : [];

  const tenancyOf = (tenantId: string) => views.find((v) => v.people.some((p) => p.id === tenantId) && v.tenancy.status === "ACTIVE") ?? views.find((v) => v.people.some((p) => p.id === tenantId));
  const unitLink = (unitId: string) => {
    const v = views.find((x) => x.unit.id === unitId && x.tenancy.status === "ACTIVE");
    const u = units.find((x) => x.id === unitId)!;
    return v ? `/tenancies/${v.tenancy.id}` : `/properties/${u.propertyId}`;
  };
  const total = tenantHits.length + unitHits.length + propHits.length + receiptHits.length;

  return (
    <>
      <PageHeader title="Search" sub={q ? `${total} ${total === 1 ? "result" : "results"} for “${q}”` : "Search by tenant name, phone, unit, property or receipt number."} />
      <form action="/search" role="search" className="mb-6 flex gap-2">
        <input name="q" defaultValue={q} aria-label="Search" autoFocus className="h-10 w-full max-w-md rounded-md border border-line-strong bg-surface px-3" />
        <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover">Search</button>
      </form>
      {q && !total && <p className="text-sm text-fg-2">No matches for “{q}”.</p>}
      <div className="space-y-6">
        {tenantHits.length > 0 && (
          <Group title="Tenants">
            {tenantHits.map((t) => {
              const v = tenancyOf(t.id);
              return <Hit key={t.id} href={v ? `/tenancies/${v.tenancy.id}` : "/tenants"} title={t.fullName} sub={[t.phone, v && `${v.unit.label} · ${v.property.name}`].filter(Boolean).join(" · ")} />;
            })}
          </Group>
        )}
        {unitHits.length > 0 && (
          <Group title="Units">
            {unitHits.map((u) => <Hit key={u.id} href={unitLink(u.id)} title={u.label} sub={properties.find((p) => p.id === u.propertyId)?.name} />)}
          </Group>
        )}
        {propHits.length > 0 && (
          <Group title="Properties">
            {propHits.map((p) => <Hit key={p.id} href={`/properties/${p.id}`} title={p.name} sub={p.city ?? undefined} />)}
          </Group>
        )}
        {receiptHits.length > 0 && (
          <Group title="Receipts & references">
            {receiptHits.map(({ r, v }) => (
              <Hit key={r.id} href={`/tenancies/${v.tenancy.id}`} title={`${r.receiptNumber ?? r.reference} · ${money(r.amountMinor, r.currency)}${r.status === "VOID" ? " (void)" : ""}`}
                sub={`${shortDate(r.entryDate)} · ${v.unit.label} · ${v.people[0]?.fullName}`} />
            ))}
          </Group>
        )}
      </div>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card title={title}><ul className="divide-y divide-line">{children}</ul></Card>;
}

function Hit({ href, title, sub }: { href: string; title: string; sub?: string }) {
  return (
    <li>
      <Link href={href} className="block px-4 py-3 hover:bg-surface-2">
        <span className="num block font-medium">{title}</span>
        {sub && <span className="block text-[13px] text-fg-2">{sub}</span>}
      </Link>
    </li>
  );
}
