import Link from "next/link";
import { roundingUnit } from "@/lib/money";
import { rateLabel } from "@/server/commands";
import type { Ctx } from "@/server/commands";
import type { MeterView } from "@/server/queries";
import { METER_TYPES, UOMS } from "@/lib/labels";
import { MeterDialog, RecordReading, type ReadingContext } from "./meter-actions";
import { Card, Empty, LOCALE, buttonClass, longDate } from "./ui";

export function readingContext(mv: MeterView, ctx: Ctx): ReadingContext {
  const m = mv.meter;
  return {
    meterId: m.id,
    title: `${mv.unit?.label ?? "Common"} · ${m.label}`,
    type: m.type,
    uom: m.uom,
    rate: m.rate,
    rateLabel: rateLabel(m.rate, m.currency),
    fixedMinor: m.fixedChargeMinor,
    currency: m.currency,
    locale: LOCALE,
    roundUnit: roundingUnit(m.currency, ctx.workspace.roundToWholeUnits),
    today: ctx.today,
    last: mv.last && { value: mv.last.value, date: longDate(mv.last.readingDate) },
    prev: mv.prev && { value: mv.prev.value, date: mv.prev.readingDate },
    tenant: mv.view && { name: mv.view.people[0]?.fullName ?? "the tenant", graceDays: mv.view.tenancy.graceDays },
    avg: mv.avgConsumption,
  };
}

/** SCR-60 Meters list, used on the property page (all meters) and the tenancy page (the unit's meters). */
export function MetersCard({ list, ctx, property, units, unitId, roundHref }: {
  list: MeterView[]; ctx: Ctx; property: { id: string; currency: string }; units: { id: string; label: string }[];
  unitId?: string; roundHref?: string;
}) {
  return (
    <Card title={`Meters (${list.length})`} action={
      <span className="flex gap-2">
        {roundHref && list.length > 1 && <Link href={roundHref} className={buttonClass.secondary}>Readings round</Link>}
        <MeterDialog propertyId={property.id} currency={property.currency} units={units} unitId={unitId} />
      </span>
    }>
      {!list.length ? (
        <Empty>No meters. Add one to bill electricity or water by reading.</Empty>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {list.map((mv) => {
            const m = mv.meter;
            const u = UOMS[m.uom as keyof typeof UOMS];
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/meters/${m.id}`} className="font-medium hover:underline">
                    {!unitId && `${mv.unit?.label ?? "Common"} · `}{m.label}
                  </Link>
                  <span className="text-fg-2"> · {METER_TYPES[m.type as keyof typeof METER_TYPES]} · {rateLabel(m.rate, m.currency)}/{u}</span>
                  <div className="num text-[13px] text-fg-2">
                    {mv.last ? `Last ${Number(mv.last.value).toLocaleString(LOCALE)} ${u} on ${longDate(mv.last.readingDate)}` : "No readings yet"}
                    {!unitId && mv.view && ` · ${mv.view.people[0]?.fullName}`}
                  </div>
                </div>
                <RecordReading r={readingContext(mv, ctx)} compact />
                <MeterDialog propertyId={property.id} currency={property.currency} units={units} m={m} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
