"use client";

import { useState } from "react";
import { moveOutAction } from "@/app/actions";
import { formatMoney, parseMoney } from "@/lib/money";
import { METHODS, PAY_METHODS } from "@/lib/labels";
import { Field, FormError, Input, MoneyInput, Select, Submit, useActionForm } from "@/components/form";

interface Line { description: string; amount: number }

// Mirrors 10 §10.1 steps 5–7 for the live preview; the server recomputes everything on finalize.
export function SettlementForm({ tenancyId, moveOut, today, currency, locale, balanceBefore, base, depositHeld, voids, proration }: {
  tenancyId: string; moveOut: string; today: string; currency: string; locale: string;
  balanceBefore: number; base: number; depositHeld: number; voids: Line[]; proration: Line[];
}) {
  const { state, pending, onSubmit } = useActionForm(moveOutAction);
  const [rows, setRows] = useState([{ category: "DAMAGE", amount: "", reason: "" }]);
  const [refundNow, setRefundNow] = useState(true);
  const fmt = (m: number) => formatMoney(m, currency, locale);

  const extra = rows.reduce((s, r) => s + (parseMoney(r.amount || "0", currency) ?? 0), 0);
  const B = base + extra;
  const apply = Math.min(depositHeld, Math.max(B, 0));
  const B2 = B - apply;
  const refund = depositHeld - apply + Math.max(-B2, 0);
  const owed = Math.max(B2, 0);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="tenancyId" value={tenancyId} />
      <input type="hidden" name="moveOut" value={moveOut} />
      <FormError state={state} fields={rows.flatMap((_, i) => [`dAmount${i}`, `dReason${i}`]).concat(["refundMethod", "refundDate"])} />

      <section className="rounded-lg border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Rent adjustments</h2>
        <ul className="divide-y divide-line text-sm">
          <Row label="Balance today" value={fmt(balanceBefore)} />
          {proration.map((l) => <Row key={l.description} label={`Credit for unused days (${l.description.replace("Rent · ", "")})`} value={`−${fmt(l.amount)}`} good />)}
          {voids.map((l) => <Row key={l.description} label={`Cancel ${l.description.replace("Rent · ", "")} (after move-out)`} value={`−${fmt(l.amount)}`} good />)}
          {!proration.length && !voids.length && <li className="px-5 py-3 text-fg-2">No rent to adjust for this date.</li>}
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Deductions from the deposit</h2>
        {rows.map((r, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-[140px_140px_1fr]">
            <Select name={`dCategory${i}`} aria-label="Type" value={r.category} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}>
              <option value="DAMAGE">Damage</option>
              <option value="CLEANING">Cleaning</option>
              <option value="OTHER">Other</option>
            </Select>
            <MoneyInput name={`dAmount${i}`} state={state} aria-label="Amount" currency={currency} value={r.amount}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
            <Input name={`dReason${i}`} state={state} aria-label="Reason" placeholder="e.g. Broken window" maxLength={120} value={r.reason}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))} />
          </div>
        ))}
        {rows.length < 10 && (
          <button type="button" onClick={() => setRows([...rows, { category: "OTHER", amount: "", reason: "" }])} className="text-sm font-medium text-primary hover:underline">
            Add another deduction
          </button>
        )}
      </section>

      <section className="rounded-lg border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Summary</h2>
        <ul className="divide-y divide-line text-sm">
          <Row label="Owed after adjustments and deductions" value={B < 0 ? `Advance ${fmt(-B)}` : fmt(B)} />
          <Row label="Deposit held" value={fmt(depositHeld)} />
          <Row label="Deposit used for dues" value={apply ? `−${fmt(apply)}` : fmt(0)} />
        </ul>
        <p className={`num border-t border-line px-5 py-4 text-xl font-semibold ${owed > 0 ? "text-overdue" : ""}`}>
          {owed > 0 ? `Tenant owes ${fmt(owed)}` : refund > 0 ? `Refund to tenant ${fmt(refund)}` : "Nothing to pay either way"}
        </p>
      </section>

      {refund > 0 && (
        <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="refundNow" checked={refundNow} onChange={(e) => setRefundNow(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            I am returning {fmt(refund)} now
          </label>
          {refundNow && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Method" name="refundMethod" state={state}>
                <Select name="refundMethod" state={state} defaultValue="BANK_TRANSFER">
                  {PAY_METHODS.map((m) => <option key={m} value={m}>{METHODS[m]}</option>)}
                </Select>
              </Field>
              <Field label="Date" name="refundDate" state={state}>
                <Input type="date" name="refundDate" state={state} defaultValue={today} min={moveOut} max={today} />
              </Field>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="text-[13px] text-fg-2">Finishing saves this final bill and marks the tenant as moved out. It can&apos;t be changed afterwards.</p>
        <Submit pending={pending}>Finish move-out</Submit>
      </div>
    </form>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <li className="flex justify-between gap-4 px-5 py-3">
      <span className="text-fg-2">{label}</span>
      <span className={`num font-medium ${good ? "text-primary" : ""}`}>{value}</span>
    </li>
  );
}
