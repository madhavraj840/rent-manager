"use client";

import { useState } from "react";
import { sendCodeAction, signInWithGoogleAction, verifyCodeAction } from "@/app/actions";
import { Field, Input, Submit, useActionForm } from "@/components/form";

// Step 1: email → code is sent. Step 2: type the code → signed in.
export function LoginForm({ linkFailed, google }: { linkFailed?: boolean; google?: boolean }) {
  const [email, setEmail] = useState("");
  const send = useActionForm(sendCodeAction);
  const verify = useActionForm(verifyCodeAction);
  const sent = !!send.state?.ok;

  return sent ? (
    <form onSubmit={verify.onSubmit} className="mt-6 space-y-4">
      <p role="status" className="rounded-md bg-primary-soft px-3 py-2 text-sm font-medium text-primary">{send.state!.ok}</p>
      <p className="text-sm">
        Open the email <span className="font-medium">in this same browser</span> and click the sign-in link. You come straight back here, signed in.
      </p>
      <p className="text-sm text-fg-2">If the email shows a number code instead, type it here:</p>
      <input type="hidden" name="email" value={email} />
      <Field label="Code from the email" name="code" state={verify.state}>
        <Input name="code" state={verify.state} inputMode="numeric" autoComplete="one-time-code" maxLength={12} className="num tracking-widest" required autoFocus />
      </Field>
      <Submit pending={verify.pending} className="w-full">Sign in with the code</Submit>
      <p className="text-[13px] text-fg-2">
        No email? Check the spam folder, or{" "}
        <button type="button" onClick={() => location.reload()} className="font-medium text-primary hover:underline">use a different email</button>.
      </p>
    </form>
  ) : (
    <form onSubmit={send.onSubmit} className="mt-6 space-y-4">
      {linkFailed && (
        <p role="alert" className="rounded-md bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue">
          That sign-in link didn&apos;t work. It may be old, already used, or opened in a different browser. Ask for a new one below.
        </p>
      )}
      <Field label="Email" name="email" state={send.state}>
        <Input type="email" name="email" state={send.state} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
      </Field>
      <Submit pending={send.pending} className="w-full">Email me a sign-in link</Submit>
      {google && <GoogleButton />}
    </form>
  );
}

/** One tap instead of waiting for an email. It must be the same email as the account. */
function GoogleButton() {
  return (
    <>
      <p className="flex items-center gap-3 text-[13px] text-fg-2"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></p>
      <button type="button" onClick={() => signInWithGoogleAction()}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line-strong bg-surface text-sm font-medium hover:bg-surface-2">
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
          <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.6 5-4.5 7l7 5.4C42.6 36.2 45 30.6 45 24z" />
          <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7-5.4C29.7 36.5 27.1 37.5 24 37.5c-5.8 0-10.7-3.9-12.5-9.1l-7.2 5.6C7.9 41.2 15.4 46 24 46z" />
          <path fill="#FBBC05" d="M11.5 28.4A13.4 13.4 0 0 1 10.8 24c0-1.5.3-3 .7-4.4l-7.2-5.6A22 22 0 0 0 2 24c0 3.5.8 6.9 2.3 10z" />
          <path fill="#EA4335" d="M24 10.5c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4 30 2 24 2 15.4 2 7.9 6.8 4.3 14l7.2 5.6C13.3 14.4 18.2 10.5 24 10.5z" />
        </svg>
        Continue with Google
      </button>
      <p className="text-[13px] text-fg-2">Use the Google account with the same email as your Rent Manager account.</p>
    </>
  );
}
