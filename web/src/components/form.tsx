"use client";

import { startTransition, useActionState, type FormEvent, type ReactNode } from "react";
import type { FormState } from "@/app/actions";

/**
 * Submit a form to a server action without React's automatic form reset,
 * so typed values survive a validation error.
 */
export function useActionForm(action: (s: FormState, fd: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return { state, pending, onSubmit };
}

export const inputClass =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[15px] text-fg placeholder:text-fg-2/70 aria-[invalid=true]:border-overdue";

export function Field({ label, hint, name, state, children, className = "" }: {
  label: string; hint?: ReactNode; name?: string; state?: FormState; children: ReactNode; className?: string;
}) {
  const error = name && state?.field === name ? state.error : undefined;
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-[13px] font-medium text-overdue">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-fg-2">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = React.ComponentProps<"input"> & { name: string; state?: FormState };

export function Input({ name, state, className = "", ...rest }: InputProps) {
  const bad = state?.field === name;
  return <input id={name} name={name} aria-invalid={bad || undefined} aria-describedby={bad ? `${name}-error` : undefined} className={`${inputClass} ${className}`} {...rest} />;
}

export function MoneyInput({ name, state, currency, ...rest }: InputProps & { currency: string }) {
  const bad = state?.field === name;
  return (
    <div className={`flex h-10 items-center rounded-md border bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${bad ? "border-overdue" : "border-line-strong"}`}>
      <span className="pl-3 text-sm text-fg-2">{currency}</span>
      <input
        id={name}
        name={name}
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={bad || undefined}
        className="num h-full w-full min-w-0 bg-transparent px-2 text-[15px] outline-none"
        {...rest}
      />
    </div>
  );
}

export function Select({ name, state, children, className = "", ...rest }: React.ComponentProps<"select"> & { name: string; state?: FormState }) {
  return (
    <select id={name} name={name} aria-invalid={state?.field === name || undefined} className={`${inputClass} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Submit({ children, pending, className = "" }: { children: ReactNode; pending: boolean; className?: string }) {
  return (
    <button
      disabled={pending}
      className={`num inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60 ${className}`}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

/** Error not tied to one field (shown at the top of the form). */
export function FormError({ state, fields = [] }: { state?: FormState; fields?: string[] }) {
  if (!state?.error || (state.field && fields.includes(state.field))) return null;
  return <p role="alert" className="rounded-md bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">{state.error}</p>;
}

// C-5: "What happens when you save" box above a money form's save button.
export function Outcome({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-fg-2">What happens when you save</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
