"use client";

import { useEffect, useRef, useState } from "react";
import { setupWorkspace } from "@/app/actions";
import { COUNTRIES, CURRENCIES, countryName, currencyOf } from "@/lib/countries";
import { Field, FormError, Input, Select, Submit, useActionForm } from "@/components/form";

/** `email` is set when signed in (cloud mode): it is shown but can't be changed. */
export function SetupForm({ email }: { email?: string }) {
  const { state, pending, onSubmit } = useActionForm(setupWorkspace);
  const [country, setCountry] = useState("IN");
  const [currency, setCurrency] = useState("INR");
  const tzRef = useRef<HTMLSelectElement>(null);
  const zones = Intl.supportedValuesOf("timeZone");
  // Preselect the browser's time zone after hydration (the server can't know it).
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tzRef.current && [...tzRef.current.options].some((o) => o.value === tz)) tzRef.current.value = tz;
  }, []);

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-lg border border-line bg-surface p-5">
      <FormError state={state} fields={["fullName", "email", "name", "countryCode", "currency", "timeZone"]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="fullName" state={state}><Input name="fullName" state={state} autoComplete="name" required maxLength={100} /></Field>
        <Field label="Email" name="email" state={state}><Input type="email" name="email" state={state} autoComplete="email" required defaultValue={email} readOnly={!!email} /></Field>
      </div>
      <Field label="Business name" name="name" state={state} hint="Usually your name or business, e.g. Sharma Rentals">
        <Input name="name" state={state} required maxLength={80} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Country" name="countryCode" state={state}>
          <Select name="countryCode" state={state} value={country} onChange={(e) => { setCountry(e.target.value); setCurrency(currencyOf(e.target.value)); }}>
            {COUNTRIES.map(([c]) => [c, countryName(c)] as const).sort((a, b) => a[1].localeCompare(b[1])).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </Select>
        </Field>
        <Field label="Default currency" name="currency" state={state}>
          <Select name="currency" state={state} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Time zone" name="timeZone" state={state} hint="Decides when rent becomes due and overdue.">
        <Select ref={tzRef} name="timeZone" state={state} defaultValue={zones.includes("Asia/Kolkata") ? "Asia/Kolkata" : "Asia/Calcutta"}>
          {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
        </Select>
      </Field>
      <Submit pending={pending} className="w-full">Start using the app</Submit>
    </form>
  );
}
