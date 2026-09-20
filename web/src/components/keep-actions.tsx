"use client";

import { deleteThingAction, putAwayAction } from "@/app/actions";
import { DialogForm } from "./dialog-form";
import { Field, Input, Outcome } from "./form";

export type Thing = "PROPERTY" | "ROOM" | "TENANT";

const WORD: Record<Thing, string> = { PROPERTY: "property", ROOM: "room", TENANT: "person" };
const link = "rounded px-1.5 py-0.5 text-[13px] font-medium text-fg-2 underline-offset-2 hover:bg-surface-2 hover:text-fg hover:underline";

/** F-DATA-1: take something out of the everyday lists without losing any of it. */
export function PutAway({ kind, id, name, away }: { kind: Thing; id: string; name: string; away: boolean }) {
  return (
    <DialogForm
      trigger={away ? "Bring back" : "Put away"}
      triggerClass={link}
      title={away ? `Bring ${name} back?` : `Put ${name} away?`}
      action={putAwayAction}
      submitLabel={away ? "Yes, bring it back" : "Yes, put it away"}
      fields={[]}
      hidden={{ kind, id, away: away ? "no" : "yes" }}
    >
      {() => (
        <>
          <p className="text-sm">
            {away
              ? `This ${WORD[kind]} is out of your everyday lists. Bring it back to use it again.`
              : `Use this for a ${WORD[kind]} you have finished with. Nothing is deleted: every payment, charge and paper stays exactly as it is.`}
          </p>
          <Outcome>
            {away
              ? `${name} goes back into your lists and can be used again.`
              : `${name} leaves your lists and the "Add tenant" choices. You will find it under "Put away", and you can bring it back any time.`}
          </Outcome>
        </>
      )}
    </DialogForm>
  );
}

/** Only offered when nothing hangs off the record; the server checks again and refuses otherwise. */
export function DeleteForGood({ kind, id, name }: { kind: Thing; id: string; name: string }) {
  return (
    <DialogForm
      trigger="Delete for good"
      triggerClass={link}
      title={`Delete ${name} for good?`}
      action={deleteThingAction}
      submitLabel="Delete for good"
      fields={["confirm"]}
      hidden={{ kind, id }}
    >
      {(state) => (
        <>
          <p className="text-sm">
            This removes the {WORD[kind]} completely. It only works while nothing hangs off it — no tenant has ever been here,
            and there are no expenses, meters or papers. If anything does, use <span className="font-medium">Put away</span> instead.
          </p>
          <Field label="Type the word delete to confirm" name="confirm" state={state}>
            <Input name="confirm" state={state} autoComplete="off" placeholder="delete" required />
          </Field>
          <Outcome>{name} is gone from every list. This cannot be undone.</Outcome>
        </>
      )}
    </DialogForm>
  );
}
