"use client";

import { saveSettingsAction } from "@/app/actions";
import { payToLines, type PayTo } from "@/lib/labels";
import { Field, FormError, Input, Select, Submit, useActionForm } from "@/components/form";
import { Card } from "@/components/ui";
import { toast } from "@/components/toaster";

const FIELDS = ["name", "timeZone", "displayName", "receiptPrefix", "upiId", "accountName", "accountNumber", "ifsc", "bankName", "payNote"];

export function SettingsForm({ w, payTo, me }: {
  w: { name: string; timeZone: string; receiptPrefix: string; roundToWholeUnits: boolean; currency: string };
  payTo: PayTo;
  me: { name: string; email: string };
}) {
  const { state, pending, onSubmit } = useActionForm(async (s, fd) => {
    const r = await saveSettingsAction(s, fd);
    if (r?.ok) toast(r.ok);
    return r;
  });
  const zones = Intl.supportedValuesOf("timeZone");
  const v = (x?: string) => x ?? "";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormError state={state} fields={FIELDS} />

      <Card title="Your business">
        <div className="space-y-4 px-4 py-4">
          <Field label="Business name" name="name" state={state} hint="Shown in the app, on receipts and at the top of statements.">
            <Input name="name" state={state} defaultValue={w.name} maxLength={80} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" name="displayName" state={state} hint="Signed at the end of the reminders you send.">
              <Input name="displayName" state={state} defaultValue={me.name} maxLength={100} required />
            </Field>
            <Field label="Your email" name="email" hint={me.email ? "The email you sign in with. It cannot be changed here." : "This copy runs on this computer only, with no sign-in."}>
              <Input name="email" defaultValue={me.email || "Not signed in"} readOnly disabled />
            </Field>
          </div>
          <Field label="Time zone" name="timeZone" state={state} hint="Decides which day it is where you are, so rent falls due and goes overdue at the right time.">
            <Select name="timeZone" state={state} defaultValue={w.timeZone}>
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
            </Select>
          </Field>
          <Field label="Currency" name="currency" hint="Every amount already saved is in this currency, so it cannot be changed here. Each property can have its own currency.">
            <Input name="currency" defaultValue={w.currency} readOnly disabled />
          </Field>
        </div>
      </Card>

      <Card title="How tenants pay you">
        <div className="space-y-4 px-4 py-4">
          <p className="text-sm text-fg-2">
            Fill in whatever you use. These lines are added to the WhatsApp reminder, so the tenant can pay straight away
            instead of asking you for the details. Leave a box empty to keep it out.
          </p>
          <Field label="UPI ID" name="upiId" state={state} hint="For example ramesh@okicici">
            <Input name="upiId" state={state} defaultValue={v(payTo.upiId)} maxLength={100} placeholder="name@bank" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank name" name="bankName" state={state}>
              <Input name="bankName" state={state} defaultValue={v(payTo.bankName)} maxLength={80} />
            </Field>
            <Field label="Name on the account" name="accountName" state={state}>
              <Input name="accountName" state={state} defaultValue={v(payTo.accountName)} maxLength={100} />
            </Field>
            <Field label="Account number" name="accountNumber" state={state}>
              <Input name="accountNumber" state={state} defaultValue={v(payTo.accountNumber)} maxLength={40} className="num" />
            </Field>
            <Field label="IFSC code" name="ifsc" state={state}>
              <Input name="ifsc" state={state} defaultValue={v(payTo.ifsc)} maxLength={20} className="num" />
            </Field>
          </div>
          <Field label="Anything else to add (optional)" name="payNote" state={state} hint="For example: please write the room number with the payment.">
            <Input name="payNote" state={state} defaultValue={v(payTo.note)} maxLength={200} />
          </Field>
          <Preview payTo={payTo} />
        </div>
      </Card>

      <Card title="Receipts and rounding">
        <div className="space-y-4 px-4 py-4">
          <Field label="Receipt numbers start with" name="receiptPrefix" state={state} hint="Receipts are numbered R-000001, R-000002 and so on. Numbers already given do not change.">
            <Input name="receiptPrefix" state={state} defaultValue={w.receiptPrefix} maxLength={8} className="num w-40" />
          </Field>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="roundToWholeUnits" defaultChecked={w.roundToWholeUnits} className="mt-0.5 h-4 w-4" />
            <span>
              Round part-month rent to whole {w.currency}
              <span className="block text-[13px] text-fg-2">
                When a tenant moves in or leaves mid-month, the part rent is rounded to the nearest whole {w.currency}. Charges already made do not change.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <Submit pending={pending}>Save settings</Submit>
    </form>
  );
}

/** What a reminder will carry, from what is saved now. */
function Preview({ payTo }: { payTo: PayTo }) {
  const saved = payToLines(payTo);
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-fg-2">Added to every reminder</p>
      {saved.length ? (
        <div className="num mt-0.5 whitespace-pre-line">{["You can pay by:", ...saved.map((l) => `• ${l}`)].join("\n")}</div>
      ) : (
        <p className="mt-0.5 text-fg-2">Nothing yet. Reminders will only say the amount and the room. Save this page to see the lines here.</p>
      )}
    </div>
  );
}
