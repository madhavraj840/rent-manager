"use client";

import { useState } from "react";
import { deleteDocumentAction, uploadDocumentAction } from "@/app/actions";
import { DOC_CATEGORIES, PERSON_DOCS } from "@/lib/labels";
import { DialogForm } from "./dialog-form";
import { Field, Input, Outcome, Select } from "./form";

const btn = {
  secondary: "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-surface-2",
  link: "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] font-medium text-fg-2 hover:bg-surface-2 hover:text-fg",
};

// ---------- SCR-76 Add document ----------

export interface DocTarget {
  entityType: "PROPERTY" | "TENANT" | "TENANCY";
  entityId: string;
  /** Where the page shows it, in words: "this tenancy", "Green View". */
  where: string;
  /** On a tenancy: the main tenant, who gets ID/address/police papers. */
  person?: { id: string; name: string };
}

export function AddDocument({ d }: { d: DocTarget }) {
  return (
    <DialogForm
      trigger="Add document" triggerClass={btn.secondary} title="Add document" subtitle={d.where} action={uploadDocumentAction}
      submitLabel="Add document" fields={["file", "category", "title"]}
      hidden={{ entityType: d.entityType, entityId: d.entityId, ...(d.person ? { personId: d.person.id } : {}) }}
    >
      {(state) => <DocFields d={d} state={state} />}
    </DialogForm>
  );
}

function DocFields({ d, state }: { d: DocTarget; state: Parameters<typeof Field>[0]["state"] }) {
  const [category, setCategory] = useState("");
  const sensitive = PERSON_DOCS.includes(category);
  const toPerson = sensitive && d.person;
  return (
    <>
      <Field label="File" hint="Photo (JPG, PNG, WebP) or PDF, up to 10 MB" name="file" state={state}>
        <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required
          className="block w-full text-sm file:mr-3 file:h-9 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:font-medium hover:file:bg-surface-2" />
      </Field>
      <Field label="What is it?" name="category" state={state}>
        <Select name="category" state={state} value={category} onChange={(e) => setCategory(e.target.value)} required>
          <option value="" disabled>Choose…</option>
          {Object.entries(DOC_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}{PERSON_DOCS.includes(k) ? " (sensitive)" : ""}</option>)}
        </Select>
      </Field>
      <Field label="Title (optional)" name="title" state={state}>
        <Input name="title" state={state} maxLength={120} placeholder="e.g. Agreement 2026–27" />
      </Field>
      <Outcome>
        {toPerson ? <>It is filed under {d.person!.name}, so it also shows on their future tenancies.</> : <>It is saved to {d.where}.</>}
        {" "}It shows under Documents on this page; click it to open.
        {sensitive && " It is marked sensitive: only owners and managers will be able to open it, and every opening is logged."}
      </Outcome>
    </>
  );
}

export function DeleteDocument({ id, name }: { id: string; name: string }) {
  return (
    <DialogForm
      trigger="Delete" triggerClass={btn.link} title="Delete this document?" subtitle={name}
      action={deleteDocumentAction} submitLabel="Delete document" fields={[]} hidden={{ id }}
    >
      {() => <p className="text-sm text-fg-2">You can restore it from Recently deleted, at the bottom of Documents, for 30 days. After that it is removed for good.</p>}
    </DialogForm>
  );
}
