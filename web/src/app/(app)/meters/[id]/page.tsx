import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatScaled, parseScaled } from "@/lib/money";
import { rateLabel } from "@/server/commands";
import { loadPortfolio, meterViews } from "@/server/queries";
import { readingContext } from "@/components/meters";
import { METER_TYPES, UOMS } from "@/lib/labels";
import { RecordReading, VoidReading } from "@/components/meter-actions";
import { Card, Chip, Crumbs, Empty, PageHeader, linkClass, longDate, money } from "@/components/ui";

export const metadata: Metadata = { title: "Meter" };

const TYPE_LABEL: Record<string, string> = { MOVE_IN: "Starting reading", REGULAR: "", METER_END: "Old meter final", METER_START: "New meter start", MOVE_OUT: "Move-out" };

// Meter history: every reading, what it used and what it billed.
export default async function MeterPage({ params }: PageProps<"/meters/[id]">) {
  const { id } = await params;
  const p = await loadPortfolio();
  const m = p.meters.find((x) => x.id === id);
  if (!m) notFound();
  const [mv] = meterViews(p, { propertyId: m.propertyId }).filter((x) => x.meter.id === id);
  if (!mv) notFound();
  const prop = p.properties.find((x) => x.id === m.propertyId)!;
  const u = UOMS[m.uom as keyof typeof UOMS];
  const charges = new Map(p.views.flatMap((v) => v.rows).filter((r) => r.meterReadingId).map((r) => [r.meterReadingId!, r]));
  const tenancyName = (tid: string | null) => p.views.find((v) => v.tenancy.id === tid)?.people[0]?.fullName;
  const latestId = mv?.last?.id;

  // Consumption since the previous active reading of the same meter (replacement pairs handled by the charge's quantity).
  const rows = mv.readings.map((r, i) => {
    const before = mv.readings.slice(0, i).findLast((x) => x.status === "ACTIVE");
    const counts = r.status === "ACTIVE" && r.readingType !== "METER_START" && r.readingType !== "METER_END" && before;
    return { r, used: counts ? parseScaled(r.value, 3)! - parseScaled(before.value, 3)! : null };
  }).reverse();

  return (
    <>
      <Crumbs items={[["Properties", "/properties"], [prop.name, `/properties/${prop.id}`], [`${mv.unit?.label ?? "Common"} · ${m.label}`]]} />
      <PageHeader
        title={`${mv.unit?.label ?? "Common"} · ${m.label}`}
        sub={`${METER_TYPES[m.type as keyof typeof METER_TYPES]} · ${rateLabel(m.rate, m.currency)} per ${u}${m.fixedChargeMinor ? ` + ${money(m.fixedChargeMinor, m.currency)} fixed` : ""}${m.serialNumber ? ` · No. ${m.serialNumber}` : ""}`}
        actions={<RecordReading r={readingContext(mv, p.ctx)} />}
      />
      <Card title="Readings">
        {!rows.length ? <Empty>No readings yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="num w-full text-sm">
              <thead className="border-b border-line text-left text-[13px] text-fg-2">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 text-right font-medium">Meter reading</th>
                  <th className="px-4 py-2.5 text-right font-medium">Units used</th>
                  <th className="px-4 py-2.5 font-medium">Bill</th>
                  <th className="px-4 py-2.5 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ r, used }) => {
                  const c = charges.get(r.id);
                  const void_ = r.status === "VOID";
                  return (
                    <tr key={r.id} className={void_ ? "text-fg-2" : ""}>
                      <td className="whitespace-nowrap px-4 py-3">{longDate(r.readingDate)}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-medium ${void_ ? "line-through" : ""}`}>{Number(r.value).toLocaleString("en-IN")} {u}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{c?.quantity ? `${formatScaled(parseScaled(c.quantity, 3)!, 3)} ${u}` : used !== null ? `${formatScaled(used, 3)} ${u}` : "—"}</td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap items-center gap-2">
                          {c ? (
                            <Link href={`/tenancies/${c.tenancyId}`} className={`${linkClass} ${c.status === "VOID" ? "line-through" : ""}`}>{money(c.amountMinor, c.currency)} · billed to {tenancyName(c.tenancyId)}</Link>
                          ) : <span className="text-fg-2">{TYPE_LABEL[r.readingType] || (r.tenancyId ? "Not billed" : "No tenant")}{r.readingType === "MOVE_IN" && r.tenancyId && ` · ${tenancyName(r.tenancyId)}`}</span>}
                          {void_ && <Chip tone="neutral">CANCELLED</Chip>}
                        </span>
                        {void_ && r.voidReason && <span className="block text-[13px] text-fg-2">Cancelled: {r.voidReason}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{r.id === latestId && <VoidReading id={r.id} summary={`${Number(r.value)} ${u} · ${longDate(r.readingDate)}`} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
