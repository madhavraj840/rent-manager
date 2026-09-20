import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import { documentsFor, loadPortfolio } from "@/server/queries";
import { DocumentsCard } from "@/components/documents";
import { EditTenant } from "@/components/tenancy-actions";
import { DeleteForGood, PutAway } from "@/components/keep-actions";
import { Card, Chevron, Chip, Crumbs, PageHeader, TenancyStatus, buttonClass, linkClass, longDate, money } from "@/components/ui";

export const metadata: Metadata = { title: "Tenant" };

const digits = (phone: string) => phone.replace(/\D/g, "");

// SCR-31 One person: every room they have rented, their contact details and their papers.
export default async function TenantPage({ params }: PageProps<"/tenants/[id]">) {
  const { id } = await params;
  const { ctx, tenants, views } = await loadPortfolio();
  const person = tenants.find((x) => x.id === id);
  if (!person) notFound();

  // Newest first: the room they are in now, then the ones they have left.
  const rank = (s: string) => (s === "ACTIVE" ? 0 : s === "ENDED" ? 1 : 2);
  const rooms = views
    .filter((v) => v.people.some((p) => p.id === person.id))
    .sort((a, b) => rank(a.tenancy.status) - rank(b.tenancy.status) || b.tenancy.startDate.localeCompare(a.tenancy.startDate));
  const now = rooms.filter((v) => v.tenancy.status === "ACTIVE");
  const owed = rooms.reduce((s, v) => s + Math.max(v.balance.balance, 0), 0);
  const held = rooms.reduce((s, v) => s + v.balance.depositHeld, 0);
  const cur = rooms[0]?.tenancy.currency ?? ctx.workspace.defaultCurrency;
  const oneCurrency = new Set(rooms.map((v) => v.tenancy.currency)).size <= 1;
  const docs = await documentsFor([{ type: "TENANT", ids: [person.id] }]);
  const hello = `Hello ${person.fullName.split(" ")[0]}, `;

  return (
    <>
      <Crumbs items={[["Tenants", "/tenants"], [person.fullName]]} />
      <PageHeader
        title={person.fullName}
        sub={person.archivedAt ? "Put away · out of your everyday lists" : now.length
          ? `In ${now.map((v) => `${v.unit.label}, ${v.property.name}`).join(" and ")}`
          : rooms.length ? "Not renting from you at the moment" : "Not in any room yet"}
        actions={
          <>
            {person.phone && (
              <>
                <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`} className={buttonClass.secondary}><Phone size={16} aria-hidden /> Call</a>
                <a href={`https://wa.me/${digits(person.phone)}?text=${encodeURIComponent(hello)}`} target="_blank" rel="noreferrer" className={buttonClass.secondary}>
                  <MessageCircle size={16} aria-hidden /> WhatsApp
                </a>
              </>
            )}
            <EditTenant t={person} />
          </>
        }
      />

      {rooms.length > 0 && oneCurrency && (
        <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
          {[
            ["Owes you now", money(owed, cur)],
            ["Deposit you hold", money(held, cur)],
            ["Rooms rented", String(rooms.length)],
            ["With you since", longDate(rooms.map((v) => v.tenancy.startDate).sort()[0])],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface px-4 py-3">
              <p className="text-[13px] text-fg-2">{k}</p>
              <p className="num mt-0.5 text-lg font-semibold">{v}</p>
            </div>
          ))}
        </div>
      )}

      <Card title={rooms.length === 1 ? "Their room" : "Their rooms"}>
        {!rooms.length ? (
          <p className="px-4 py-6 text-sm text-fg-2">
            This person is not in any room. Use <Link href="/tenancies/new" className={linkClass}>Add tenant</Link> to put them in one.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rooms.map((v) => (
              <li key={v.tenancy.id} className="relative flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2">
                <Link href={`/tenancies/${v.tenancy.id}`} className="min-w-0 flex-1 after:absolute after:inset-0 max-sm:basis-full">
                  <span className="block font-medium">{v.unit.label} · {v.property.name}</span>
                  <span className="num block text-[13px] text-fg-2">
                    {v.people.length > 1 && `Shared with ${v.people.filter((p) => p.id !== person.id).map((p) => p.fullName).join(", ")} · `}
                    {longDate(v.tenancy.startDate)} to {v.tenancy.movedOutOn ? longDate(v.tenancy.movedOutOn) : "now"} · rent {money(v.rent, v.tenancy.currency)} a month
                  </span>
                </Link>
                <span className="num font-medium">{v.balance.balance > 0 ? money(v.balance.balance, v.tenancy.currency) : "—"}</span>
                <TenancyStatus v={v} />
                <Chevron />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Contact details" action={<EditTenant t={person} />}>
          <dl className="num grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 px-4 py-3 text-sm">
            <dt className="text-fg-2">Phone</dt><dd>{person.phone || "Not filled in"}</dd>
            {person.altPhone && <><dt className="text-fg-2">Other phone</dt><dd>{person.altPhone}</dd></>}
            <dt className="text-fg-2">Email</dt><dd className="break-all">{person.email || "Not filled in"}</dd>
            <dt className="text-fg-2">Permanent address</dt><dd className="whitespace-pre-line">{person.address || "Not filled in"}</dd>
            <dt className="text-fg-2">Emergency contact</dt>
            <dd>{person.emergencyName ? `${person.emergencyName}${person.emergencyPhone ? ` · ${person.emergencyPhone}` : ""}` : "Not filled in"}</dd>
            {person.idType && <><dt className="text-fg-2">ID</dt><dd>{person.idType}{person.idLast4 && ` ending ${person.idLast4}`}</dd></>}
            {person.notes && <><dt className="text-fg-2">Notes</dt><dd className="whitespace-pre-line">{person.notes}</dd></>}
          </dl>
        </Card>
        <Card title="Where they have been">
          <ul className="divide-y divide-line px-4 text-sm">
            {rooms.map((v) => (
              <li key={v.tenancy.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2.5">
                <span>{v.unit.label}, {v.property.name}</span>
                <span className="num text-[13px] text-fg-2">
                  {longDate(v.tenancy.startDate)} – {v.tenancy.movedOutOn ? longDate(v.tenancy.movedOutOn) : "now"}
                </span>
                {v.tenancy.status === "CLOSED" && <Chip tone="neutral">MOVED OUT</Chip>}
              </li>
            ))}
            {!rooms.length && <li className="py-6 text-fg-2">Nothing yet.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-6">
        <DocumentsCard docs={docs} target={{ entityType: "TENANT", entityId: person.id, where: `${person.fullName}'s papers` }}
          owners={{ [person.id]: person.fullName }} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-1 text-[13px] text-fg-2">
        {person.archivedAt
          ? <>{person.fullName} is put away, so they stay out of your lists.<PutAway kind="TENANT" id={person.id} name={person.fullName} away /></>
          : now.length
            ? `${person.fullName} is renting a room right now. Move them out first to put them away.`
            : <>
                Finished with {person.fullName}?
                <PutAway kind="TENANT" id={person.id} name={person.fullName} away={false} />
                {!rooms.length && !docs.length && <DeleteForGood kind="TENANT" id={person.id} name={person.fullName} />}
              </>}
      </div>
    </>
  );
}
