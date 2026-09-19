"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { saveExpenseAction, voidExpenseAction } from "@/app/actions";
import { currencyDigits } from "@/lib/money";
import { EXPENSE_CATEGORIES, METHODS, PAY_METHODS } from "@/lib/labels";
import { DialogForm } from "./dialog-form";
import { Field, Input, MoneyInput, Outcome, Select } from "./form";

export interface ExpenseOptions {
  today: string;
  defaultCurrency: string;
  properties: { id: string; name: string; currency: string }[];
  units: { id: string; label: string; propertyId: string }[];
}

export interface ExpenseValues {
  id: string; propertyId: string | null; unitId: string | null; category: string; amountMinor: number; currency: string;
  expenseDate: string; payee: string | null; method: string | null; reference: string | null; note: string | null;
}

const btn = {
  primary: "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-on-primary hover:bg-primary-hover",
  link: "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] font-medium text-fg-2 hover:bg-surface-2 hover:text-fg",
};

// SCR-72 Expense form: add, or edit when `e` is given.
export function ExpenseDialog({ o, e, propertyId }: { o: ExpenseOptions; e?: ExpenseValues; propertyId?: string }) {
  return (
    <DialogForm
      trigger={e ? <><Pencil size={13} aria-hidden /> Edit</> : "Add expense"} triggerClass={e ? btn.link : btn.primary}
      title={e ? "Edit expense" : "Add expense"} action={saveExpenseAction} submitLabel={e ? "Save" : "Add expense"}
      fields={["propertyId", "unitId", "category", "amount", "expenseDate", "payee", "method", "reference", "note", "receipt"]}
      hidden={e ? { id: e.id } : undefined}
    >
      {(state) => <ExpenseFields o={o} e={e} initialProperty={e ? e.propertyId ?? "" : propertyId ?? ""} state={state} />}
    </DialogForm>
  );
}

function ExpenseFields({ o, e, initialProperty, state }: {
  o: ExpenseOptions; e?: ExpenseValues; initialProperty: string; state: Parameters<typeof Field>[0]["state"];
}) {
  const [propertyId, setPropertyId] = useState(initialProperty);
  const currency = o.properties.find((p) => p.id === propertyId)?.currency ?? o.defaultCurrency;
  const units = o.units.filter((u) => u.propertyId === propertyId);
  const propName = o.properties.find((p) => p.id === propertyId)?.name;
  const amount = e ? (e.amountMinor / 10 ** currencyDigits(e.currency)).toString() : "";
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Property" name="propertyId" state={state}>
          <Select name="propertyId" state={state} value={propertyId} onChange={(ev) => setPropertyId(ev.target.value)}>
            <option value="">General (all properties)</option>
            {o.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Unit (optional)" name="unitId" state={state}>
          <Select key={propertyId} name="unitId" state={state} defaultValue={e?.propertyId === propertyId ? e?.unitId ?? "" : ""} disabled={!units.length}>
            <option value="">Whole property</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" name="category" state={state}>
          <Select name="category" state={state} defaultValue={e?.category ?? "REPAIR"}>
            {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Amount" name="amount" state={state}>
          <MoneyInput name="amount" state={state} currency={currency} defaultValue={amount} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" name="expenseDate" state={state}>
          <Input type="date" name="expenseDate" state={state} defaultValue={e?.expenseDate ?? o.today} required />
        </Field>
        <Field label="Paid with (optional)" name="method" state={state}>
          <Select name="method" state={state} defaultValue={e?.method ?? ""}>
            <option value="">—</option>
            {PAY_METHODS.map((m) => <option key={m} value={m}>{METHODS[m]}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Paid to (optional)" name="payee" state={state}>
        <Input name="payee" state={state} defaultValue={e?.payee ?? ""} maxLength={120} placeholder="e.g. Ravi Plumbing" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Reference (optional)" name="reference" state={state}>
          <Input name="reference" state={state} defaultValue={e?.reference ?? ""} maxLength={100} placeholder="Bill or UTR no." />
        </Field>
        <Field label="Note (optional)" name="note" state={state}>
          <Input name="note" state={state} defaultValue={e?.note ?? ""} maxLength={500} />
        </Field>
      </div>
      <Field label={e ? "Add a receipt (optional)" : "Receipt (optional)"} hint="Photo or PDF of the bill, up to 10 MB. It opens from the expense row." name="receipt" state={state}>
        <input id="receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-sm file:mr-3 file:h-9 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:font-medium hover:file:bg-surface-2" />
      </Field>
      <Outcome>
        The expense is saved under Expenses{propName ? ` for ${propName}` : " as a general expense"}. It lowers &quot;Left after expenses&quot; on the dashboard for that month.
        {" "}A receipt, if you add one, opens from the expense row.
      </Outcome>
      <p className="text-[13px] text-fg-2">Want the tenant to pay this? Add it here, then use Add charge on the tenant&apos;s page.</p>
    </>
  );
}

export function VoidExpense({ id, summary }: { id: string; summary: string }) {
  return (
    <DialogForm
      trigger="Cancel" triggerClass={btn.link} title="Cancel this expense?" subtitle={summary}
      action={voidExpenseAction} submitLabel="Cancel expense" fields={["reason"]} hidden={{ id }}
    >
      {(state) => (
        <>
          <p className="text-sm">Use this when the expense is wrong, for example it was entered twice. It stays in the list, crossed out, and no longer counts in any total.</p>
          <Field label="Why is it wrong?" name="reason" state={state}>
            <Input name="reason" state={state} maxLength={200} placeholder="e.g. Entered twice" required />
          </Field>
        </>
      )}
    </DialogForm>
  );
}
