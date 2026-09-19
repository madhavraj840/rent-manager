"use client";

import { useState } from "react";
import { saveProperty } from "@/app/actions";
import { COUNTRIES, CURRENCIES, countryName, currencyOf } from "@/lib/countries";
import { PROPERTY_TYPES } from "@/lib/labels";
import { Field, FormError, Input, Select, Submit, useActionForm } from "./form";

type P = { id?: string; name?: string; type?: string; addressLine1?: string | null; city?: string | null; region?: string | null; postalCode?: string | null; countryCode: string; currency: string; notes?: string | null };

// SCR-22 Property form (add and edit)
export function PropertyForm({ p, currencyLocked }: { p: P; currencyLocked?: boolean }) {
  const { state, pending, onSubmit } = useActionForm(saveProperty);
  const [country, setCountry] = useState(p.countryCode);
  const [currency, setCurrency] = useState(p.currency);
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <FormError state={state} fields={["name", "type", "countryCode", "currency", "addressLine1", "city"]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Property name" name="name" state={state}><Input name="name" state={state} defaultValue={p.name} required maxLength={100} placeholder="e.g. Green View Apartments" /></Field>
        <Field label="Type" name="type" state={state}>
          <Select name="type" state={state} defaultValue={p.type ?? "RESIDENTIAL_BUILDING"}>
            {Object.entries(PROPERTY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Address" name="addressLine1" state={state}><Input name="addressLine1" state={state} defaultValue={p.addressLine1 ?? ""} maxLength={200} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City" name="city" state={state}><Input name="city" state={state} defaultValue={p.city ?? ""} maxLength={100} /></Field>
        <Field label="State / region" name="region"><Input name="region" defaultValue={p.region ?? ""} maxLength={100} /></Field>
        <Field label="Postal code" name="postalCode"><Input name="postalCode" defaultValue={p.postalCode ?? ""} maxLength={20} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Country" name="countryCode" state={state}>
          <Select name="countryCode" state={state} value={country} onChange={(e) => { setCountry(e.target.value); if (!currencyLocked) setCurrency(currencyOf(e.target.value)); }}>
            {COUNTRIES.map(([c]) => [c, countryName(c)] as const).sort((a, b) => a[1].localeCompare(b[1])).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </Select>
        </Field>
        <Field label="Currency" name="currency" state={state} hint={currencyLocked ? "Locked, because this property already has tenants." : "All rent and deposits for this property use it."}>
          {currencyLocked && <input type="hidden" name="currency" value={currency} />}
          <Select name={currencyLocked ? "currency-locked" : "currency"} state={state} value={currency} disabled={currencyLocked} onChange={(e) => setCurrency(e.target.value)}>
            {[...new Set([...CURRENCIES, currency])].map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Notes (optional)" name="notes">
        <textarea id="notes" name="notes" defaultValue={p.notes ?? ""} maxLength={2000} rows={3} className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px]" />
      </Field>
      <div className="flex justify-end"><Submit pending={pending}>{p.id ? "Save changes" : "Add property"}</Submit></div>
    </form>
  );
}
