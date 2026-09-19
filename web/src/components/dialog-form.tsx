"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { FormState } from "@/app/actions";
import { FormError, Submit, useActionForm } from "./form";
import { toast } from "./toaster";

type Action = (s: FormState, fd: FormData) => Promise<FormState>;

/**
 * A button that opens a native <dialog> with a form posting to a server action.
 * Closes on success and shows the action's `ok` message as a toast.
 */
export function DialogForm({ trigger, triggerClass, title, subtitle, action, submitLabel, fields, children, hidden }: {
  trigger: ReactNode;
  triggerClass: string;
  title: string;
  subtitle?: ReactNode;
  action: Action;
  submitLabel: ReactNode;
  /** Field names rendered inside, so their errors show inline instead of at the top. */
  fields: string[];
  hidden?: Record<string, string>;
  children: (state: FormState) => ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Toast as soon as the action resolves: the component may unmount when the page refreshes (e.g. a voided row).
  const { state, pending, onSubmit } = useActionForm(async (s: FormState, fd: FormData) => {
    const r = await action(s, fd);
    if (r?.ok) toast(r.ok);
    return r;
  });
  const [key, setKey] = useState(0); // remount the form each time it opens so defaults refresh
  const [openedWith, setOpenedWith] = useState<FormState>(undefined);
  const shown = state !== openedWith && !state?.ok ? state : undefined; // only errors from this opening

  useEffect(() => {
    if (!state?.ok) return;
    ref.current?.close();
  }, [state]);

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => { setKey((k) => k + 1); setOpenedWith(state); ref.current?.showModal(); }}>
        {trigger}
      </button>
      <dialog ref={ref} aria-label={title} className="m-auto max-h-[calc(100dvh-32px)] w-[min(100vw-32px,480px)] rounded-lg border border-line bg-surface p-0 text-fg">
        <form key={key} onSubmit={onSubmit} className="flex flex-col">
          {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-semibold">{title}</h2>
              {subtitle && <div className="num text-sm text-fg-2">{subtitle}</div>}
            </div>
            <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="rounded p-1 text-fg-2 hover:bg-surface-2">
              <X size={18} aria-hidden />
            </button>
          </header>
          <div className="space-y-4 px-5 py-4">
            <FormError state={shown} fields={fields} />
            {children(shown)}
          </div>
          <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" onClick={() => ref.current?.close()} className="h-10 rounded-md px-4 text-sm font-medium text-fg-2 hover:bg-surface-2">
              Cancel
            </button>
            <Submit pending={pending}>{submitLabel}</Submit>
          </footer>
        </form>
      </dialog>
    </>
  );
}
