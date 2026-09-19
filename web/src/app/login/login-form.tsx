"use client";

import { useState } from "react";
import { sendCodeAction, verifyCodeAction } from "@/app/actions";
import { Field, Input, Submit, useActionForm } from "@/components/form";

// Step 1: email → code is sent. Step 2: type the code → signed in.
export function LoginForm() {
  const [email, setEmail] = useState("");
  const send = useActionForm(sendCodeAction);
  const verify = useActionForm(verifyCodeAction);
  const sent = !!send.state?.ok;

  return sent ? (
    <form onSubmit={verify.onSubmit} className="mt-6 space-y-4">
      <p role="status" className="rounded-md bg-primary-soft px-3 py-2 text-sm font-medium text-primary">{send.state!.ok}</p>
      <input type="hidden" name="email" value={email} />
      <Field label="Code from the email" name="code" state={verify.state}>
        <Input name="code" state={verify.state} inputMode="numeric" autoComplete="one-time-code" maxLength={12} className="num tracking-widest" required autoFocus />
      </Field>
      <Submit pending={verify.pending} className="w-full">Sign in</Submit>
      <p className="text-[13px] text-fg-2">
        No email? Check the spam folder, or{" "}
        <button type="button" onClick={() => location.reload()} className="font-medium text-primary hover:underline">use a different email</button>.
      </p>
    </form>
  ) : (
    <form onSubmit={send.onSubmit} className="mt-6 space-y-4">
      <Field label="Email" name="email" state={send.state}>
        <Input type="email" name="email" state={send.state} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
      </Field>
      <Submit pending={send.pending} className="w-full">Send me a code</Submit>
    </form>
  );
}
