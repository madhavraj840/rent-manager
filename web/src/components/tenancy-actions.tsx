"use client";

import { useState } from "react";
import {
  addChargeAction, addCreditAction, changeRentAction, giveNoticeAction, recordPaymentAction, updateTenantAction, updateTermsAction, voidEntryAction, withdrawNoticeAction,
} from "@/app/actions";
import { addDays, currencyDigits, formatMoney } from "@/lib/money";
import { CHARGE_CATEGORIES, CREDIT_CATEGORIES, METHODS, PAY_METHODS } from "@/lib/labels";
import { DialogForm } from "./dialog-form";
import { Field, Input, MoneyInput, Outcome, Select } from "./form";

export interface PaymentContext {
  tenancyId: string;
  title: string;
  currency: string;
  locale: string;
  today: string;
  graceDays: number;
  due: number;
  overdue: number;
  depositDue: number;
  open: { label: string; remaining: number; amount: number }[];
}

const toMajor = (minor: number, currency: string) => (minor / 10 ** currencyDigits(currency)).toString();

const btn = {
  primary: "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-on-primary hover:bg-primary-hover",
  secondary: "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-surface-2",
  compact: "h-8 shrink-0 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] font-medium hover:bg-surface-2",
  link: "rounded px-1.5 py-0.5 text-[13px] font-medium text-fg-2 underline-offset-2 hover:bg-surface-2 hover:text-fg hover:underline",
};

// ---------- SCR-43 Record payment ----------

export function RecordPayment({ p, compact }: { p: PaymentContext; compact?: boolean }) {
  return (
    <DialogForm
      trigger="Record payment"
      triggerClass={compact ? btn.compact : btn.primary}
      title={p.title}
      subtitle={<>Due now {formatMoney(p.due, p.currency, p.locale)}{p.overdue > 0 && <span className="text-overdue"> (overdue {formatMoney(p.overdue, p.currency, p.locale)})</span>}</>}
      action={recordPaymentAction}
      submitLabel="Record payment"
      fields={["rent", "deposit", "date", "method"]}
      hidden={{ tenancyId: p.tenancyId }}
    >
      {(state) => <PaymentFields p={p} state={state} />}
    </DialogForm>
  );
}

function PaymentFields({ p, state }: { p: PaymentContext; state: Parameters<typeof Field>[0]["state"] }) {
  const [rent, setRent] = useState(p.due > 0 ? toMajor(p.due, p.currency) : "");
  const [method, setMethod] = useState("UPI");
  const fmt = (m: number) => formatMoney(m, p.currency, p.locale);
  const digits = currencyDigits(p.currency);
  const rentMinor = Math.round((Number(rent.replace(/,/g, "")) || 0) * 10 ** digits);

  // Live FIFO preview (10 §3): oldest open charge first.
  let pool = rentMinor;
  const clears: string[] = [];
  for (const c of p.open) {
    if (pool <= 0) break;
    const part = Math.min(pool, c.remaining);
    pool -= part;
    clears.push(part === c.remaining ? `${c.label} (${fmt(part)})` : `${c.label} (${fmt(part)} of ${fmt(c.remaining)})`);
  }

  return (
    <>
      <Field label="Towards rent & charges" name="rent" state={state}>
        <MoneyInput name="rent" state={state} currency={p.currency} value={rent} onChange={(e) => setRent(e.target.value)} />
      </Field>
      {p.depositDue > 0 && (
        <Field label={`Towards deposit (${fmt(p.depositDue)} due)`} name="deposit" state={state}>
          <MoneyInput name="deposit" state={state} currency={p.currency} defaultValue={toMajor(p.depositDue, p.currency)} />
        </Field>
      )}
      <Field label="Date received" name="date" state={state}>
        <Input type="date" name="date" state={state} defaultValue={p.today} max={addDays(p.today, 1)} required />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Method</legend>
        <div className="flex flex-wrap gap-2">
          {PAY_METHODS.map((m) => (
            <label key={m} className="cursor-pointer rounded-full border border-line-strong px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-medium has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              {METHODS[m]}
            </label>
          ))}
        </div>
      </fieldset>
      {method !== "CASH" && (
        <Field label="Reference (optional)" name="reference">
          <Input name="reference" placeholder="UTR, cheque no." maxLength={100} />
        </Field>
      )}
      <Field label="Note (optional)" name="note">
        <Input name="note" maxLength={500} />
      </Field>
      <Outcome>
        {rentMinor > 0 ? (
          <>
            {clears.length > 0 && <span className="block">Clears {clears.join(", ")}.</span>}
            {pool > 0 && <span className="block">{fmt(pool)} is kept as advance for the next rent.</span>}
          </>
        ) : p.depositDue > 0 ? <span className="block">Only the deposit amount is recorded.</span> : null}
        <span className="block text-fg-2">A receipt number is given. The payment shows under Payments and charges for {p.title}.</span>
      </Outcome>
    </>
  );
}

// ---------- SCR-44 Add charge ----------

export function AddCharge({ p }: { p: PaymentContext }) {
  return (
    <DialogForm
      trigger="Add charge" triggerClass={btn.secondary} title="Add charge" subtitle={p.title}
      action={addChargeAction} submitLabel="Add charge" fields={["category", "description", "amount", "date", "dueDate"]}
      hidden={{ tenancyId: p.tenancyId }}
    >
      {(state) => <ChargeFields p={p} state={state} />}
    </DialogForm>
  );
}

function ChargeFields({ p, state }: { p: PaymentContext; state: Parameters<typeof Field>[0]["state"] }) {
  const [category, setCategory] = useState<keyof typeof CHARGE_CATEGORIES>("UTILITY");
  const [description, setDescription] = useState("Electricity bill");
  const defaults: Record<string, string> = { UTILITY: "Electricity bill", MAINTENANCE: "Maintenance", LATE_FEE: "Late fee", PARKING: "Parking", DAMAGE: "Damage repair", CLEANING: "Cleaning", TAX: "Tax", OTHER: "" };
  return (
    <>
      <Field label="Category" name="category" state={state}>
        <Select name="category" state={state} value={category} onChange={(e) => {
          const c = e.target.value as keyof typeof CHARGE_CATEGORIES;
          if (description === defaults[category]) setDescription(defaults[c]);
          setCategory(c);
        }}>
          {Object.entries(CHARGE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Description" name="description" state={state}>
        <Input name="description" state={state} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} required />
      </Field>
      <Field label="Amount" name="amount" state={state}>
        <MoneyInput name="amount" state={state} currency={p.currency} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" name="date" state={state}>
          <Input type="date" name="date" state={state} defaultValue={p.today} required />
        </Field>
        <Field label="Due by" name="dueDate" state={state}>
          <Input type="date" name="dueDate" state={state} defaultValue={addDays(p.today, p.graceDays)} required />
        </Field>
      </div>
      <Outcome>The amount is added to what {p.title} owes and shows under Payments and charges. It counts as overdue after the due date.</Outcome>
    </>
  );
}

// ---------- SCR-45 Add credit ----------

export function AddCredit({ p }: { p: PaymentContext }) {
  return (
    <DialogForm
      trigger="Discount" triggerClass={btn.secondary} title="Give a discount" subtitle={p.title}
      action={addCreditAction} submitLabel="Save" fields={["category", "amount", "date", "reason"]}
      hidden={{ tenancyId: p.tenancyId }}
    >
      {(state) => (
        <>
          <Field label="Type" name="category" state={state}>
            <Select name="category" state={state} defaultValue="DISCOUNT">
              {Object.entries(CREDIT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Amount" name="amount" state={state} hint="Lowers what the tenant owes. It is not money received.">
            <MoneyInput name="amount" state={state} currency={p.currency} required />
          </Field>
          <Field label="Date" name="date" state={state}>
            <Input type="date" name="date" state={state} defaultValue={p.today} required />
          </Field>
          <Field label="Reason" name="reason" state={state}>
            <Input name="reason" state={state} maxLength={200} placeholder="e.g. Plumbing repair paid by tenant" required />
          </Field>
          <Outcome>What {p.title} owes goes down by this amount, oldest dues first. It shows under Payments and charges. No receipt is given.</Outcome>
        </>
      )}
    </DialogForm>
  );
}

// ---------- SCR-47 Cancel an entry (void) ----------

export function VoidEntry({ entryId, summary, receipt }: { entryId: string; summary: string; receipt?: string }) {
  return (
    <DialogForm
      trigger="Cancel" triggerClass={btn.link} title="Cancel this entry?" subtitle={summary}
      action={voidEntryAction} submitLabel="Cancel entry" fields={["reason"]} hidden={{ entryId }}
    >
      {(state) => (
        <>
          <p className="text-sm">Use this when the entry is wrong, for example it was entered twice or has the wrong amount.</p>
          <Field label="Why is it wrong?" name="reason" state={state}>
            <Input name="reason" state={state} maxLength={200} placeholder="e.g. Entered twice" required />
          </Field>
          <Outcome>
            The entry stays in the list, crossed out, and no longer counts in any balance.
            {receipt && ` Receipt ${receipt} will show CANCELLED.`} To correct it, cancel it and then enter it again.
          </Outcome>
        </>
      )}
    </DialogForm>
  );
}

// ---------- Change rent (10 §7) ----------

export function ChangeRent({ p, rent, cycleDay, nextStart, chargedStarts }: {
  p: PaymentContext; rent: number; cycleDay: number; nextStart: string; chargedStarts: string[];
}) {
  return (
    <DialogForm
      trigger="Change rent" triggerClass={btn.secondary} title="Change rent" subtitle={<>Now {formatMoney(rent, p.currency, p.locale)} a month · {p.title}</>}
      action={changeRentAction} submitLabel="Change rent" fields={["rent", "effectiveFrom", "reason"]} hidden={{ tenancyId: p.tenancyId }}
    >
      {(state) => <RentFields p={p} state={state} cycleDay={cycleDay} nextStart={nextStart} chargedStarts={chargedStarts} />}
    </DialogForm>
  );
}

function RentFields({ p, state, cycleDay, nextStart, chargedStarts }: {
  p: PaymentContext; state: Parameters<typeof Field>[0]["state"]; cycleDay: number; nextStart: string; chargedStarts: string[];
}) {
  const [from, setFrom] = useState(nextStart);
  const already = chargedStarts.filter((s) => s >= from).length;
  return (
    <>
      <Field label="New monthly rent" name="rent" state={state}>
        <MoneyInput name="rent" state={state} currency={p.currency} required />
      </Field>
      <Field label="From" name="effectiveFrom" state={state}
        hint={`Must be a rent day (the ${cycleDay}${cycleDay === 1 ? "st" : "th"}).${already ? ` ${already} ${already === 1 ? "month is" : "months are"} already charged from this date. The difference is added as a correction, which you can cancel.` : ""}`}>
        <Input type="date" name="effectiveFrom" state={state} value={from} onChange={(e) => setFrom(e.target.value)} required />
      </Field>
      <Field label="Reason (optional)" name="reason" state={state}>
        <Input name="reason" state={state} maxLength={200} placeholder="e.g. Yearly increase" />
      </Field>
    </>
  );
}

// ---------- Tenant is leaving: notice (F-MOUT-1) ----------

export function GiveNotice({ p, name, startDate, leaseEnd }: { p: PaymentContext; name: string; startDate: string; leaseEnd?: string | null }) {
  return (
    <DialogForm
      trigger="Tenant is leaving" triggerClass={btn.secondary} title="Tenant is leaving" subtitle={p.title}
      action={giveNoticeAction} submitLabel="Save leaving date" fields={["noticeDate", "plannedMoveOut", "givenBy"]} hidden={{ tenancyId: p.tenancyId }}
    >
      {(state) => <NoticeFields p={p} name={name} startDate={startDate} leaseEnd={leaseEnd} state={state} />}
    </DialogForm>
  );
}

function NoticeFields({ p, name, startDate, leaseEnd, state }: {
  p: PaymentContext; name: string; startDate: string; leaseEnd?: string | null; state: Parameters<typeof Field>[0]["state"];
}) {
  const [by, setBy] = useState<"TENANT" | "LANDLORD">("TENANT");
  const [leaving, setLeaving] = useState(leaseEnd && leaseEnd >= p.today ? leaseEnd : addDays(p.today, 30));
  const nice = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString(p.locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const option = "flex items-center gap-2 rounded-md border border-line-strong px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary-soft";
  return (
    <>
      <p className="text-sm">
        Use this when {name} tells you they will leave, or when you ask them to leave. It only saves the leaving date. They move out later, with <span className="font-medium">Move out</span>.
      </p>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Who decided?</legend>
        <div className="grid gap-2 text-sm">
          <label className={option}><input type="radio" name="givenBy" value="TENANT" checked={by === "TENANT"} onChange={() => setBy("TENANT")} /> {name} told me they are leaving</label>
          <label className={option}><input type="radio" name="givenBy" value="LANDLORD" checked={by === "LANDLORD"} onChange={() => setBy("LANDLORD")} /> I asked {name} to leave</label>
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label={by === "TENANT" ? "Date they told you" : "Date you told them"} name="noticeDate" state={state}>
          <Input type="date" name="noticeDate" state={state} defaultValue={p.today} min={startDate} max={p.today} required />
        </Field>
        <Field label="Last day in the room" name="plannedMoveOut" state={state}>
          <Input type="date" name="plannedMoveOut" state={state} value={leaving} onChange={(e) => setLeaving(e.target.value)} min={startDate} required />
        </Field>
      </div>
      <Outcome>
        {leaving ? <>This page will show &quot;Leaving on {nice(leaving)}&quot;. Rent is not charged for months that start after that day.</> : "Choose the last day in the room."}
        {" "}Nothing else changes now. On the day they leave, use Move out to settle the deposit and close their record.
      </Outcome>
    </>
  );
}

export function WithdrawNotice({ tenancyId }: { tenancyId: string }) {
  return (
    <DialogForm
      trigger="Not leaving any more" triggerClass={btn.link} title="Is the tenant staying?" action={withdrawNoticeAction} submitLabel="Yes, they are staying" fields={[]} hidden={{ tenancyId }}
    >
      {() => (
        <>
          <p className="text-sm">Use this when the tenant has changed their mind and will stay.</p>
          <Outcome>The leaving date is removed. Monthly rent is charged again, including any months that were skipped.</Outcome>
        </>
      )}
    </DialogForm>
  );
}

// ---------- Terms ----------

const textareaClass = "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px]";

export function EditTerms({ p, leaseEnd, notes }: { p: PaymentContext; leaseEnd?: string | null; notes?: string | null }) {
  return (
    <DialogForm
      trigger="Edit" triggerClass={btn.link} title="Edit terms" subtitle={p.title}
      action={updateTermsAction} submitLabel="Save" fields={["leaseEnd", "graceDays", "notes"]} hidden={{ tenancyId: p.tenancyId }}
    >
      {(state) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rent agreement ends (optional)" name="leaseEnd" state={state}>
              <Input type="date" name="leaseEnd" state={state} defaultValue={leaseEnd ?? ""} />
            </Field>
            <Field label="Days to pay" name="graceDays" state={state}>
              <Input type="number" name="graceDays" state={state} defaultValue={p.graceDays} min={0} max={60} required />
            </Field>
          </div>
          <p className="text-[13px] text-fg-2">A new number of days to pay applies to rent charged from now on.</p>
          <Field label="Notes" name="notes" state={state}>
            <textarea id="notes" name="notes" defaultValue={notes ?? ""} maxLength={2000} rows={3} className={textareaClass} />
          </Field>
        </>
      )}
    </DialogForm>
  );
}

// ---------- SCR-31 Edit tenant ----------

export interface TenantDetails {
  id: string; fullName: string; phone: string | null; altPhone: string | null; email: string | null; address: string | null;
  emergencyName: string | null; emergencyPhone: string | null; notes: string | null;
}

export function EditTenant({ t }: { t: TenantDetails }) {
  const v = (x: string | null) => x ?? "";
  return (
    <DialogForm
      trigger="Edit" triggerClass={btn.link} title="Edit tenant" subtitle={t.fullName} action={updateTenantAction} submitLabel="Save"
      fields={["fullName", "phone", "altPhone", "email", "address", "emergencyName", "emergencyPhone", "notes"]} hidden={{ tenantId: t.id }}
    >
      {(state) => (
        <>
          <Field label="Full name" name="fullName" state={state}>
            <Input name="fullName" state={state} defaultValue={t.fullName} maxLength={120} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" name="phone" state={state}><Input type="tel" name="phone" state={state} defaultValue={v(t.phone)} maxLength={30} /></Field>
            <Field label="Other phone" name="altPhone" state={state}><Input type="tel" name="altPhone" state={state} defaultValue={v(t.altPhone)} maxLength={30} /></Field>
          </div>
          <Field label="Email" name="email" state={state}><Input type="email" name="email" state={state} defaultValue={v(t.email)} maxLength={200} /></Field>
          <Field label="Permanent address" name="address" state={state}><Input name="address" state={state} defaultValue={v(t.address)} maxLength={300} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Emergency contact" name="emergencyName" state={state}><Input name="emergencyName" state={state} defaultValue={v(t.emergencyName)} maxLength={120} /></Field>
            <Field label="Their phone" name="emergencyPhone" state={state}><Input type="tel" name="emergencyPhone" state={state} defaultValue={v(t.emergencyPhone)} maxLength={30} /></Field>
          </div>
          <Field label="Notes" name="notes" state={state}>
            <textarea id="notes" name="notes" defaultValue={v(t.notes)} maxLength={2000} rows={3} className={textareaClass} />
          </Field>
        </>
      )}
    </DialogForm>
  );
}
