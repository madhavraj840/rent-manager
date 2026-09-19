"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { recordReadingAction, saveMeterAction, voidReadingAction } from "@/app/actions";
import { addDays, currencyDigits, formatMoney, formatScaled, parseScaled, utilityAmount } from "@/lib/money";
import { METER_TYPES, UOMS } from "@/lib/labels";
import { DialogForm } from "./dialog-form";
import { Field, Input, MoneyInput, Select } from "./form";


const btn = {
  primary: "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-on-primary hover:bg-primary-hover",
  secondary: "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-surface-2",
  compact: "h-8 shrink-0 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] font-medium hover:bg-surface-2",
  link: "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] font-medium text-fg-2 hover:bg-surface-2 hover:text-fg",
};

// ---------- SCR-61 Meter form ----------

export interface MeterValues {
  id: string; unitId: string | null; type: string; label: string; serialNumber: string | null; uom: string; rate: string; fixedChargeMinor: number;
}

export function MeterDialog({ propertyId, currency, units, m, unitId }: {
  propertyId: string; currency: string; units: { id: string; label: string }[]; m?: MeterValues; unitId?: string;
}) {
  const fixed = m?.fixedChargeMinor ? String(m.fixedChargeMinor / 10 ** currencyDigits(currency)) : "";
  return (
    <DialogForm
      trigger={m ? <><Pencil size={13} aria-hidden /> Edit</> : "Add meter"} triggerClass={m ? btn.link : btn.secondary}
      title={m ? "Edit meter" : "Add meter"} action={saveMeterAction} submitLabel={m ? "Save" : "Add meter"}
      fields={["unitId", "type", "label", "serialNumber", "uom", "rate", "fixed"]} hidden={{ propertyId, ...(m ? { id: m.id } : {}) }}
    >
      {(state) => (
        <>
          <Field label="Attached to" name="unitId" state={state}>
            <Select name="unitId" state={state} defaultValue={m ? m.unitId ?? "" : unitId ?? ""}>
              <option value="">Whole property (common meter)</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" name="type" state={state}>
              <Select name="type" state={state} defaultValue={m?.type ?? "ELECTRICITY"}>
                {Object.entries(METER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Name" name="label" state={state}>
              <Input name="label" state={state} defaultValue={m?.label ?? "Main meter"} maxLength={40} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Measured in" name="uom" state={state}>
              <Select name="uom" state={state} defaultValue={m?.uom ?? "KWH"}>
                {Object.entries(UOMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Rate per unit" name="rate" state={state}>
              <MoneyInput name="rate" state={state} currency={currency} defaultValue={m?.rate ? String(Number(m.rate)) : ""} placeholder="9.50" required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fixed charge per bill" name="fixed" state={state}>
              <MoneyInput name="fixed" state={state} currency={currency} defaultValue={fixed} placeholder="0" />
            </Field>
            <Field label="Serial no. (optional)" name="serialNumber" state={state}>
              <Input name="serialNumber" state={state} defaultValue={m?.serialNumber ?? ""} maxLength={60} />
            </Field>
          </div>
          {m && <p className="text-[13px] text-fg-2">A new rate applies to bills from now on. Past bills keep their rate.</p>}
        </>
      )}
    </DialogForm>
  );
}

// ---------- SCR-62 Record reading ----------

export interface ReadingContext {
  meterId: string;
  title: string;
  type: string;
  uom: string;
  rate: string;
  rateLabel: string;
  fixedMinor: number;
  currency: string;
  locale: string;
  roundUnit: number;
  today: string;
  last?: { value: string; date: string };
  prev?: { value: string; date: string }; // billable previous reading (inside this tenancy)
  tenant?: { name: string; graceDays: number };
  avg: number;
}

export function RecordReading({ r, compact }: { r: ReadingContext; compact?: boolean }) {
  return (
    <DialogForm
      trigger={compact ? "Reading" : "Record reading"} triggerClass={compact ? btn.compact : btn.primary}
      title="Record reading" subtitle={r.title} action={recordReadingAction} submitLabel="Save reading"
      fields={["date", "value", "oldFinal", "newStart", "amount", "dueDate"]} hidden={{ meterId: r.meterId }}
    >
      {(state) => <ReadingFields r={r} state={state} />}
    </DialogForm>
  );
}

function ReadingFields({ r, state }: { r: ReadingContext; state: Parameters<typeof Field>[0]["state"] }) {
  const [value, setValue] = useState("");
  const [day, setDay] = useState(r.today);
  const [replaced, setReplaced] = useState(false);
  const [oldFinal, setOldFinal] = useState("");
  const [newStart, setNewStart] = useState("0");
  const [bill, setBill] = useState(!!(r.tenant && r.prev));
  const u = UOMS[r.uom as keyof typeof UOMS] ?? r.uom;
  const fmt = (m: number) => formatMoney(m, r.currency, r.locale);

  const v = parseScaled(value, 3);
  const prev = r.prev ? parseScaled(r.prev.value, 3)! : null;
  const consumption = v === null || prev === null ? null
    : replaced ? (parseScaled(oldFinal, 3) ?? prev) - prev + (v - (parseScaled(newStart, 3) ?? 0)) : v - prev;
  const amount = consumption !== null && consumption >= 0 ? utilityAmount(consumption, parseScaled(r.rate, 4)!, r.fixedMinor, r.currency, r.roundUnit) : null;
  const high = consumption !== null && r.avg > 0 && consumption / 1000 > 5 * r.avg;

  return (
    <>
      <p className="num rounded-md bg-surface-2 px-3 py-2 text-sm">
        {r.last ? <>Last reading <span className="font-semibold">{Number(r.last.value).toLocaleString(r.locale)} {u}</span> on {r.last.date}</> : "No readings yet. This one will be the starting point."}
        <span className="block text-[13px] text-fg-2">Rate {r.rateLabel} per {u}{r.fixedMinor > 0 && ` + ${fmt(r.fixedMinor)} fixed`}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" name="date" state={state}>
          <Input type="date" name="date" state={state} value={day} max={r.today} onChange={(e) => setDay(e.target.value)} required />
        </Field>
        <Field label={`Reading (${u})`} name="value" state={state}>
          <Input name="value" state={state} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} className="num" required />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="replaced" checked={replaced} onChange={(e) => setReplaced(e.target.checked)} /> Meter replaced since the last reading
      </label>
      {replaced && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Old meter's final reading" name="oldFinal" state={state}>
            <Input name="oldFinal" state={state} inputMode="decimal" value={oldFinal} onChange={(e) => setOldFinal(e.target.value)} className="num" required />
          </Field>
          <Field label="New meter started at" name="newStart" state={state}>
            <Input name="newStart" state={state} inputMode="decimal" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="num" />
          </Field>
        </div>
      )}
      {!r.tenant ? (
        <p className="text-[13px] text-fg-2">No current tenant on this meter, so the reading is saved without a bill.</p>
      ) : !r.prev ? (
        <p className="text-[13px] text-fg-2">This is the first reading for {r.tenant.name}. It is saved as their starting reading; the next one is billed.</p>
      ) : (
        <>
          {consumption !== null && (
            <p className={`num text-sm ${consumption < 0 ? "text-overdue" : ""}`}>
              {consumption < 0 ? "The reading is lower than the last one." : <>{formatScaled(consumption, 3)} {u} × {r.rateLabel}{r.fixedMinor > 0 && ` + ${fmt(r.fixedMinor)}`} = <span className="font-semibold">{fmt(amount!)}</span></>}
              {high && <span className="block text-due">Much higher than usual (average {r.avg.toLocaleString(r.locale)} {u}). Check the reading.</span>}
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="bill" checked={bill} onChange={(e) => setBill(e.target.checked)} /> Add to {r.tenant.name}&apos;s balance
          </label>
          {bill && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" name="amount" state={state} hint="Leave empty to use the calculation">
                <MoneyInput name="amount" state={state} currency={r.currency} placeholder={amount !== null ? String(amount / 10 ** currencyDigits(r.currency)) : ""} />
              </Field>
              <Field label="Due by" name="dueDate" state={state}>
                <Input key={day} type="date" name="dueDate" state={state} defaultValue={addDays(day, r.tenant.graceDays)} required />
              </Field>
            </div>
          )}
        </>
      )}
    </>
  );
}

export function VoidReading({ id, summary }: { id: string; summary: string }) {
  return (
    <DialogForm
      trigger="Void" triggerClass={btn.link} title="Void this reading?" subtitle={summary}
      action={voidReadingAction} submitLabel="Void reading" fields={["reason"]} hidden={{ id }}
    >
      {(state) => (
        <>
          <p className="text-sm text-fg-2">The reading stays in the history, struck through. If it was billed, that charge is voided too.</p>
          <Field label="Reason" name="reason" state={state}>
            <Input name="reason" state={state} maxLength={200} placeholder="e.g. Misread the meter" required />
          </Field>
        </>
      )}
    </DialogForm>
  );
}
