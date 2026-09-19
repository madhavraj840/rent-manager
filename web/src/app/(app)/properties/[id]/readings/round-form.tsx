"use client";

import { useState } from "react";
import Link from "next/link";
import { readingsRoundAction } from "@/app/actions";
import { formatMoney, formatScaled, parseScaled, utilityAmount } from "@/lib/money";
import { UOMS } from "@/lib/labels";
import type { ReadingContext } from "@/components/meter-actions";
import { FormError, Submit, useActionForm } from "@/components/form";

export function RoundForm({ rows, today, backHref }: { rows: ReadingContext[]; today: string; backHref: string }) {
  const { state, pending, onSubmit } = useActionForm(readingsRoundAction);
  const [values, setValues] = useState<Record<string, string>>({});
  const errors = state?.rows ?? {};
  // Rows saved in the last submit are cleared; failed ones keep their value.
  const [lastAt, setLastAt] = useState<number | undefined>();
  if (state?.at && state.at !== lastAt) {
    setLastAt(state.at);
    setValues((vs) => Object.fromEntries(Object.entries(vs).filter(([k]) => errors[k])));
  }

  const plan = rows.map((r) => {
    const v = parseScaled(values[r.meterId] ?? "", 3);
    const prev = r.prev ? parseScaled(r.prev.value, 3)! : null;
    const used = v !== null && prev !== null ? v - prev : null;
    const amount = used !== null && used >= 0 && r.tenant ? utilityAmount(used, parseScaled(r.rate, 4)!, r.fixedMinor, r.currency, r.roundUnit) : 0;
    return { r, v, used, amount };
  });
  const entered = plan.filter((x) => x.v !== null).length;
  const totals = new Map<string, number>();
  for (const x of plan) if (x.amount > 0) totals.set(x.r.currency, (totals.get(x.r.currency) ?? 0) + x.amount);

  if (!rows.length) return <p className="text-sm text-fg-2">No meters in this property. <Link href={backHref} className="font-medium text-primary hover:underline">Add one</Link></p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="flex w-fit flex-col gap-1 text-sm font-medium">Date of readings
        <input type="date" name="date" defaultValue={today} max={today} required className="h-9 rounded-md border border-line-strong bg-surface px-2.5 font-normal" />
      </label>
      {state?.ok && <p role="status" className="rounded-md bg-primary-soft px-3 py-2 text-sm font-medium text-primary">{state.ok}</p>}
      <FormError state={state} fields={["date"]} />
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="num w-full text-sm">
          <thead className="border-b border-line text-left text-[13px] text-fg-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Meter</th>
              <th className="px-4 py-2.5 font-medium">Tenant</th>
              <th className="px-4 py-2.5 text-right font-medium">Last reading</th>
              <th className="px-4 py-2.5 font-medium">New reading</th>
              <th className="px-4 py-2.5 text-right font-medium">Used</th>
              <th className="px-4 py-2.5 text-right font-medium">Bill</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {plan.map(({ r, used, amount }) => {
              const u = UOMS[r.uom as keyof typeof UOMS];
              const err = errors[r.meterId];
              const bad = used !== null && used < 0;
              return (
                <tr key={r.meterId} className={err || bad ? "bg-overdue-soft" : ""}>
                  <td className="px-4 py-2.5 font-medium">{r.title}</td>
                  <td className="px-4 py-2.5 text-fg-2">{r.tenant?.name ?? "Vacant"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-fg-2">{r.last ? <>{Number(r.last.value).toLocaleString(r.locale)}<span className="block text-[12px]">{r.last.date}</span></> : "—"}</td>
                  <td className="px-4 py-2.5">
                    <input name={`v_${r.meterId}`} aria-label={`New reading for ${r.title}`} inputMode="decimal" autoComplete="off"
                      value={values[r.meterId] ?? ""} onChange={(e) => setValues((vs) => ({ ...vs, [r.meterId]: e.target.value }))}
                      aria-invalid={!!err || bad || undefined}
                      className="h-9 w-32 rounded-md border border-line-strong bg-surface px-2.5 text-right aria-[invalid=true]:border-overdue" />
                    {err && <span className="mt-1 block max-w-64 text-[12px] font-medium text-overdue">{err}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">{used !== null ? (bad ? <span className="text-overdue">Lower than last</span> : `${formatScaled(used, 3)} ${u}`) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium">
                    {amount > 0 ? formatMoney(amount, r.currency, r.locale) : r.tenant && !r.prev && values[r.meterId] ? <span className="font-normal text-fg-2">Starting reading</span> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="num text-sm text-fg-2">
          {entered} of {rows.length} entered{totals.size > 0 && ` · ${[...totals].map(([c, n]) => formatMoney(n, c)).join(" + ")} to bill`}
        </span>
        <Link href={backHref} className="h-10 rounded-md px-4 text-sm font-medium leading-10 text-fg-2 hover:bg-surface-2">Done</Link>
        <Submit pending={pending}>Save {entered || ""} {entered === 1 ? "reading" : "readings"}</Submit>
      </div>
    </form>
  );
}
