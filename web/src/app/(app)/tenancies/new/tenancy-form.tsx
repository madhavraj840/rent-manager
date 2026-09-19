"use client";

import { useState } from "react";
import { startTenancyAction } from "@/app/actions";
import { addDays, currencyDigits, formatMoney, parseMoney, periodStartFor, nextPeriodStart, rentSchedule, roundingUnit } from "@/lib/money";
import { Field, FormError, Input, MoneyInput, Select, Submit, useActionForm } from "@/components/form";

interface UnitOption { id: string; label: string; property: string; currency: string; rent: number; deposit: number; occupied: boolean }

const major = (minor: number, cur: string) => (minor ? (minor / 10 ** currencyDigits(cur)).toString() : "");
const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
const pretty = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function TenancyForm({ units, tenants, today, roundWhole, initialUnit }: {
  units: UnitOption[]; tenants: { id: string; name: string; phone: string }[]; today: string; roundWhole: boolean; initialUnit: string;
}) {
  const { state, pending, onSubmit } = useActionForm(startTenancyAction);
  const [unitId, setUnitId] = useState(initialUnit);
  const unit = units.find((u) => u.id === unitId)!;
  const cur = unit.currency;
  const [existing, setExisting] = useState(false);
  const [who, setWho] = useState<"new" | "existing">("new");
  const [startDate, setStartDate] = useState(today);
  const [rent, setRent] = useState(major(unit.rent, cur));
  const [deposit, setDeposit] = useState(major(unit.deposit, cur));
  const [cycle, setCycle] = useState<"calendar" | "movein">("calendar");
  const [grace, setGrace] = useState("4");
  const [opening, setOpening] = useState<"none" | "owes" | "ahead">("none");

  const cycleDay = cycle === "movein" ? Math.min(Number(startDate.slice(8)) || 1, 28) : 1;
  const thisPeriod = periodStartFor(today, cycleDay);
  const billingOptions = [thisPeriod, nextPeriodStart(thisPeriod, cycleDay)].filter((d) => d >= startDate);
  const [billingStart, setBillingStart] = useState("");
  const billing = billingOptions.includes(billingStart) ? billingStart : billingOptions[0] ?? thisPeriod;

  const rentMinor = parseMoney(rent || "0", cur) ?? 0;
  const graceDays = Math.max(0, Math.min(60, Number(grace) || 0));
  const preview = rentMinor > 0 && startDate
    ? rentSchedule({
        tenancyId: "preview", billingStart: existing ? billing : startDate, cycleDay, graceDays,
        until: [today, existing ? billing : startDate].sort()[1], // at least the first period, even for a future move-in
        unit: roundingUnit(cur, roundWhole), rentAt: () => rentMinor,
      }).slice(0, 4)
    : [];

  const pickUnit = (id: string) => {
    const u = units.find((x) => x.id === id)!;
    setUnitId(id);
    setRent(major(u.rent, u.currency));
    setDeposit(major(u.deposit, u.currency));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormError state={state} fields={["unitId", "fullName", "phone", "email", "startDate", "rent", "deposit", "graceDays", "billingStart", "depositHeld", "openingAmount", "leaseEnd"]} />

      <Section title="Unit & people">
        <Field label="Unit" name="unitId" state={state}>
          <Select name="unitId" state={state} value={unitId} onChange={(e) => pickUnit(e.target.value)}>
            {[...new Set(units.map((u) => u.property))].map((prop) => (
              <optgroup key={prop} label={prop}>
                {units.filter((u) => u.property === prop).map((u) => (
                  <option key={u.id} value={u.id}>{u.label}{u.occupied ? " (occupied)" : ""}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        {unit.occupied && !existing && (
          <p className="rounded-md bg-due-soft px-3 py-2 text-sm text-due">This unit has a current tenancy. A new one can only start after that tenant moves out.</p>
        )}

        <label className="flex items-start gap-3 rounded-md border border-line p-3">
          <input type="checkbox" name="existing" checked={existing} onChange={(e) => setExisting(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
          <span>
            <span className="block text-sm font-medium">The tenant already lives here</span>
            <span className="block text-[13px] text-fg-2">Use this to move an existing tenant into the app, with any money they owe or paid ahead.</span>
          </span>
        </label>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Main tenant</legend>
          <div className="mb-3 flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={who === "new"} onChange={() => setWho("new")} className="accent-[var(--primary)]" /> New person</label>
            <label className="flex items-center gap-2"><input type="radio" checked={who === "existing"} onChange={() => setWho("existing")} disabled={!tenants.length} className="accent-[var(--primary)]" /> Someone already added</label>
          </div>
          {who === "existing" ? (
            <Select name="tenantId" defaultValue={tenants[0]?.id}>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}{t.phone ? ` · ${t.phone}` : ""}</option>)}
            </Select>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Full name" name="fullName" state={state} className="sm:col-span-3"><Input name="fullName" state={state} required maxLength={120} autoComplete="off" /></Field>
              <Field label="Phone" name="phone" state={state} className="sm:col-span-1"><Input name="phone" state={state} type="tel" maxLength={30} placeholder="+91 98450 12345" /></Field>
              <Field label="Email (optional)" name="email" state={state} className="sm:col-span-2"><Input name="email" state={state} type="email" /></Field>
            </div>
          )}
        </fieldset>
        <Field label="Other tenants (optional)" name="coTenants" hint="One name per line. They share this tenancy and its balance.">
          <textarea id="coTenants" name="coTenants" rows={2} className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px]" />
        </Field>
      </Section>

      <Section title="Rent">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={existing ? "Moved in on" : "Move-in date"} name="startDate" state={state}>
            <Input type="date" name="startDate" state={state} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </Field>
          <Field label="Monthly rent" name="rent" state={state}>
            <MoneyInput name="rent" state={state} currency={cur} value={rent} onChange={(e) => setRent(e.target.value)} required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rent period starts" name="cycle">
            <Select name="cycle" value={cycle} onChange={(e) => setCycle(e.target.value as "calendar" | "movein")}>
              <option value="calendar">On the 1st of each month</option>
              <option value="movein">On the move-in day ({ordinal(Math.min(Number(startDate.slice(8)) || 1, 28))})</option>
            </Select>
          </Field>
          <Field label="Days to pay" name="graceDays" state={state} hint={`e.g. rent for the period from ${pretty(thisPeriod)} is due by ${pretty(addDays(thisPeriod, graceDays))}.`}>
            <Input name="graceDays" state={state} type="number" min={0} max={60} value={grace} onChange={(e) => setGrace(e.target.value)} />
          </Field>
        </div>
        <Field label="Lease ends (optional)" name="leaseEnd" state={state}>
          <Input type="date" name="leaseEnd" state={state} min={startDate} />
        </Field>
      </Section>

      <Section title="Deposit">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Security deposit agreed" name="deposit" state={state} hint={existing ? undefined : "Record the deposit payment after saving."}>
            <MoneyInput name="deposit" state={state} currency={cur} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          </Field>
          {existing && (
            <Field label="Deposit you already hold" name="depositHeld" state={state}>
              <MoneyInput name="depositHeld" state={state} currency={cur} defaultValue={deposit} key={deposit} />
            </Field>
          )}
        </div>
      </Section>

      {existing && (
        <Section title="Starting point in this app">
          <Field label="Start billing from" name="billingStart" state={state} hint="Rent before this date is covered by the opening balance below.">
            <Select name="billingStart" state={state} value={billing} onChange={(e) => setBillingStart(e.target.value)}>
              {billingOptions.map((d) => <option key={d} value={d}>{pretty(d)}</option>)}
            </Select>
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Before {pretty(billing)}, the tenant…</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {([["none", "was fully paid"], ["owes", "owed money"], ["ahead", "had paid ahead"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name="openingKind" value={k} checked={opening === k} onChange={() => setOpening(k)} className="accent-[var(--primary)]" /> {l}
                </label>
              ))}
            </div>
          </fieldset>
          {opening !== "none" && (
            <Field label={opening === "owes" ? "Amount owed" : "Amount paid ahead"} name="openingAmount" state={state}>
              <MoneyInput name="openingAmount" state={state} currency={cur} required />
            </Field>
          )}
        </Section>
      )}

      {preview.length > 0 && (
        <Section title="First charges">
          <ul className="divide-y divide-line rounded-md border border-line text-sm">
            {preview.map((c) => (
              <li key={c.key} className="flex justify-between gap-3 px-3 py-2">
                <span>{c.description.replace("Rent · ", "")}<span className="block text-[13px] text-fg-2">due {pretty(c.dueDate)}</span></span>
                <span className="num font-medium">{formatMoney(c.amount, cur)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-fg-2">Later months are added automatically on each period start.</p>
        </Section>
      )}

      <div className="flex justify-end">
        <Submit pending={pending}>{existing ? "Add tenancy" : "Start tenancy"}</Submit>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
