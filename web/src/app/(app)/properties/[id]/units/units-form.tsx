"use client";

import { useState } from "react";
import { createUnits } from "@/app/actions";
import { UNIT_TYPES } from "@/lib/labels";
import { unitLabels } from "@/lib/units";
import { Field, FormError, Input, MoneyInput, Select, Submit, useActionForm } from "@/components/form";

export function UnitsForm({ propertyId, currency, existing }: { propertyId: string; currency: string; existing: string[] }) {
  const { state, pending, onSubmit } = useActionForm(createUnits);
  const [mode, setMode] = useState<"one" | "many">("many");
  const [pattern, setPattern] = useState("Room {n}");
  const [count, setCount] = useState("10");
  const [start, setStart] = useState("101");
  const [step, setStep] = useState("1");
  const [pad, setPad] = useState("0");
  const [type, setType] = useState("ROOM");

  const labels = mode === "many" ? unitLabels(pattern, Number(count) || 0, Number(start) || 0, Number(step) || 1, Number(pad) || 0) : [];
  const taken = new Set(existing);
  const clashes = labels.filter((l) => taken.has(l.toLowerCase())).length;

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="mode" value={mode} />
      <div role="tablist" aria-label="How many" className="inline-flex rounded-md border border-line-strong p-0.5">
        {(["one", "many"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`h-8 rounded px-4 text-sm font-medium ${mode === m ? "bg-primary text-on-primary" : "text-fg-2 hover:text-fg"}`}>
            {m === "one" ? "One room" : "Many at once"}
          </button>
        ))}
      </div>
      <FormError state={state} fields={["label", "pattern", "count", "type", "rent", "deposit"]} />

      {mode === "one" ? (
        <Field label="Room name" name="label" state={state} hint="e.g. Flat 101, Room 3, Bed A">
          <Input name="label" state={state} required maxLength={40} />
        </Field>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name pattern" name="pattern" state={state} hint="{n} is replaced by the number">
              <Input name="pattern" state={state} value={pattern} onChange={(e) => setPattern(e.target.value)} maxLength={40} />
            </Field>
            <Field label="How many" name="count" state={state}>
              <Input name="count" state={state} type="number" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Start at" name="start"><Input name="start" type="number" min={0} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Step" name="step"><Input name="step" type="number" min={1} max={100} value={step} onChange={(e) => setStep(e.target.value)} /></Field>
            <Field label="Min. digits" name="pad"><Input name="pad" type="number" min={0} max={6} value={pad} onChange={(e) => setPad(e.target.value)} /></Field>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Preview ({labels.length}){clashes > 0 && <span className="text-overdue"> · {clashes} already exist</span>}</p>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-line bg-bg p-2">
              {labels.slice(0, 200).map((l, i) => (
                <span key={i} className={`rounded px-2 py-0.5 text-[13px] ${taken.has(l.toLowerCase()) ? "bg-overdue-soft text-overdue line-through" : "bg-surface"}`}>{l}</span>
              ))}
              {!labels.length && <span className="text-[13px] text-fg-2">Nothing to create</span>}
            </div>
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" name="type" state={state}>
          <Select name="type" state={state} value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(UNIT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Floor or block (optional)" name="floorLabel"><Input name="floorLabel" maxLength={40} placeholder="e.g. Ground floor" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Usual rent (optional)" name="rent" state={state} hint="Filled in for you when you add a tenant.">
          <MoneyInput name="rent" state={state} currency={currency} />
        </Field>
        <Field label="Usual deposit (optional)" name="deposit" state={state}>
          <MoneyInput name="deposit" state={state} currency={currency} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Submit pending={pending}>{mode === "one" ? "Add room" : `Add ${labels.length} rooms`}</Submit>
      </div>
    </form>
  );
}
