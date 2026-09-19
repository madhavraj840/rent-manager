"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { formatMoney, parseMoney, parseScaled } from "@/lib/money";
import { unitLabels } from "@/lib/units";
import { CHARGE_CATEGORIES, CREDIT_CATEGORIES, DOC_CATEGORIES, EXPENSE_CATEGORIES, PERSON_DOCS, PAY_METHODS, PROPERTY_TYPES as PT, UNIT_TYPES as UT } from "@/lib/labels";
import * as cmd from "@/server/commands";
import { requireCtx } from "@/server/queries";
import { seedSample } from "@/server/sample";

export type FormState = { error?: string; field?: string; ok?: string; at?: number; rows?: Record<string, string> } | undefined;

// Trust boundary: every action validates with Zod, then calls a command (commands re-check business rules).

class FieldError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}

async function guard(fn: () => Promise<FormState | void>): Promise<FormState> {
  try {
    return (await fn()) ?? undefined;
  } catch (e) {
    if (e instanceof FieldError) return { error: e.message, field: e.field };
    if (e instanceof cmd.DomainError) return { error: e.message, field: e.field };
    if (e instanceof z.ZodError) {
      const issue = e.issues[0];
      return { error: issue.message, field: String(issue.path[0] ?? "") };
    }
    throw e; // redirect() and real bugs
  }
}

const str = (max = 200) => z.string().trim().max(max);
const opt = (max = 200) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const date = (value: string | undefined, field: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) throw new FieldError(field, "Choose a date");
  return value;
};
const form = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

function money(value: string | undefined, currency: string, field: string, { required = false, positive = false } = {}) {
  if (!value?.trim()) {
    if (required) throw new FieldError(field, "Enter an amount");
    return 0;
  }
  const m = parseMoney(value, currency);
  if (m === null) throw new FieldError(field, "Enter a valid amount");
  if (positive && m <= 0) throw new FieldError(field, "Amount must be more than zero");
  return m;
}

async function tenancyCurrency(id: string) {
  const db = await getDb();
  const [tn] = await db.select({ currency: t.tenancies.currency }).from(t.tenancies).where(eq(t.tenancies.id, id));
  if (!tn) throw new FieldError("", "Tenant record not found");
  return tn.currency;
}

// ---------- Workspace (SCR-03) ----------

export async function setupWorkspace(_: FormState, fd: FormData): Promise<FormState> {
  const r = await guard(async () => {
    const v = z.object({
      fullName: str(100).min(1, "Enter your name"),
      email: z.email("Enter a valid email"),
      name: str(80).min(2, "Workspace name needs at least 2 characters"),
      countryCode: z.string().regex(/^[A-Z]{2}$/, "Choose a country"),
      currency: z.string().regex(/^[A-Z]{3}$/, "Choose a currency"),
      timeZone: str(60).min(1, "Choose a time zone"),
    }).parse(form(fd));
    await cmd.createWorkspace(v);
  });
  if (r) return r;
  redirect("/dashboard");
}

export async function loadSample(): Promise<void> {
  const ctx = await requireCtx();
  await seedSample(ctx);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ---------- Properties (SCR-22) and units (SCR-24) ----------

const PROPERTY_TYPES = Object.keys(PT) as [keyof typeof PT, ...(keyof typeof PT)[]];

export async function saveProperty(_: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const r = await guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const v = z.object({
      name: str(100).min(1, "Enter a property name"),
      type: z.enum(PROPERTY_TYPES, "Choose a type"),
      addressLine1: opt(200), city: opt(100), region: opt(100), postalCode: opt(20), notes: opt(2000),
      countryCode: z.string().regex(/^[A-Z]{2}$/, "Choose a country"),
      currency: z.string().regex(/^[A-Z]{3}$/, "Choose a currency"),
    }).parse(f);
    id = f.id ? await cmd.updateProperty(ctx, f.id, v) : await cmd.createProperty(ctx, v);
  });
  if (r) return r;
  revalidatePath("/", "layout");
  redirect(`/properties/${id}`);
}

const UNIT_TYPES = Object.keys(UT) as [keyof typeof UT, ...(keyof typeof UT)[]];

export async function createUnits(_: FormState, fd: FormData): Promise<FormState> {
  const f = form(fd);
  const r = await guard(async () => {
    const ctx = await requireCtx();
    const db = await getDb();
    const [p] = await db.select().from(t.properties).where(eq(t.properties.id, f.propertyId));
    if (!p) throw new FieldError("", "Property not found");
    const type = z.enum(UNIT_TYPES, "Choose a room type").parse(f.type);
    const base = {
      type,
      floorLabel: f.floorLabel?.trim() || undefined,
      defaultRentMinor: money(f.rent, p.currency, "rent") || undefined,
      defaultDepositMinor: money(f.deposit, p.currency, "deposit") || undefined,
    };
    let labels: string[];
    if (f.mode === "many") {
      const n = z.object({
        count: z.coerce.number().int().min(1, "Add at least 1 room").max(500, "At most 500 at once"),
        start: z.coerce.number().int().min(0).max(100000),
        step: z.coerce.number().int().min(1).max(100),
        pad: z.coerce.number().int().min(0).max(6),
        pattern: str(40).min(1, "Enter a name pattern"),
      }).parse(f);
      labels = unitLabels(n.pattern, n.count, n.start, n.step, n.pad);
    } else {
      labels = [z.string().trim().min(1, "Enter a room name").max(40).parse(f.label)];
    }
    if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) throw new FieldError("pattern", "The pattern creates the same name twice");
    if (labels.some((l) => l.length > 40)) throw new FieldError("pattern", "Room names can be at most 40 characters");
    try {
      await cmd.addUnits(ctx, p.id, labels.map((label) => ({ ...base, label })));
    } catch (e) {
      // Point the error at the field that is actually on screen.
      if (e instanceof cmd.DomainError && e.field === "label") throw new FieldError(f.mode === "many" ? "pattern" : "label", e.message);
      throw e;
    }
  });
  if (r) return r;
  revalidatePath("/", "layout");
  redirect(`/properties/${f.propertyId}`);
}

// ---------- Tenancies (SCR-40 / SCR-41) ----------

export async function startTenancyAction(_: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const r = await guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const db = await getDb();
    const [unit] = await db.select().from(t.units).where(eq(t.units.id, f.unitId ?? ""));
    if (!unit) throw new FieldError("unitId", "Choose a room");
    const [p] = await db.select().from(t.properties).where(eq(t.properties.id, unit.propertyId));
    const cur = p.currency;
    const existing = f.existing === "on";
    const startDate = date(f.startDate, "startDate");
    const cycleDay = f.cycle === "movein" ? Math.min(Number(startDate.slice(8)), 28) : z.coerce.number().int().min(1).max(28).parse(f.cycleDay || "1");

    const tenantId = f.tenantId || undefined;
    const tenant = tenantId ? undefined : z.object({
      fullName: str(120).min(1, "Enter the tenant's name"),
      phone: opt(30),
      email: z.union([z.literal(""), z.email("Enter a valid email")]).optional().transform((v) => v || undefined),
    }).parse({ fullName: f.fullName, phone: f.phone, email: f.email });

    const openingKind = f.openingKind;
    const openingAmount = money(f.openingAmount, cur, "openingAmount");
    id = await cmd.startTenancy(ctx, {
      unitId: unit.id,
      tenantId,
      tenant,
      coTenants: (f.coTenants ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10),
      startDate,
      existing,
      billingStart: existing ? date(f.billingStart, "billingStart") : undefined,
      cycleDay,
      graceDays: z.coerce.number({ error: "Enter days to pay" }).int().min(0, "0 to 60 days").max(60, "0 to 60 days").parse(f.graceDays || "0"),
      rentMinor: money(f.rent, cur, "rent", { required: true, positive: true }),
      depositMinor: money(f.deposit, cur, "deposit"),
      depositHeldMinor: existing ? money(f.depositHeld, cur, "depositHeld") : 0,
      openingOwedMinor: existing && openingKind === "owes" ? openingAmount : 0,
      openingAdvanceMinor: existing && openingKind === "ahead" ? openingAmount : 0,
      leaseEndDate: f.leaseEnd ? date(f.leaseEnd, "leaseEnd") : undefined,
    });
  });
  if (r) return r;
  revalidatePath("/", "layout");
  redirect(`/tenancies/${id}`);
}

// ---------- Money (SCR-43…47) ----------

const METHOD = z.enum(PAY_METHODS, "Choose a method");

export async function recordPaymentAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const cur = await tenancyCurrency(f.tenancyId);
    const res = await cmd.recordPayment(ctx, {
      tenancyId: f.tenancyId,
      rentMinor: money(f.rent, cur, "rent"),
      depositMinor: money(f.deposit, cur, "deposit"),
      date: date(f.date, "date"),
      method: METHOD.parse(f.method),
      reference: f.reference?.trim().slice(0, 100),
      note: f.note?.trim().slice(0, 500),
    });
    revalidatePath("/", "layout");
    return {
      ok: `Payment recorded · receipt ${res.receipts.join(", ")} · shown under Payments and charges${res.duplicate ? ". Possible duplicate: a payment with the same amount and date exists." : ""}`,
      at: Date.now(),
    };
  });
}

export async function addChargeAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const cur = await tenancyCurrency(f.tenancyId);
    await cmd.addCharge(ctx, {
      tenancyId: f.tenancyId,
      category: z.enum(Object.keys(CHARGE_CATEGORIES) as [string, ...string[]], "Choose a category").parse(f.category),
      description: str(120).min(1, "Enter a description").parse(f.description),
      amountMinor: money(f.amount, cur, "amount", { required: true, positive: true }),
      date: date(f.date, "date"),
      dueDate: date(f.dueDate, "dueDate"),
    });
    revalidatePath("/", "layout");
    return { ok: "Charge added · shown under Payments and charges", at: Date.now() };
  });
}

export async function addCreditAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const cur = await tenancyCurrency(f.tenancyId);
    await cmd.addCredit(ctx, {
      tenancyId: f.tenancyId,
      category: z.enum(Object.keys(CREDIT_CATEGORIES) as [string, ...string[]], "Choose a type").parse(f.category),
      amountMinor: money(f.amount, cur, "amount", { required: true, positive: true }),
      date: date(f.date, "date"),
      reason: str(200).min(1, "Enter a reason").parse(f.reason),
    });
    revalidatePath("/", "layout");
    return { ok: "Discount recorded · shown under Payments and charges", at: Date.now() };
  });
}

export async function voidEntryAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    await cmd.voidEntry(ctx, { entryId: f.entryId, reason: str(200).min(1, "Enter a reason").parse(f.reason) });
    revalidatePath("/", "layout");
    return { ok: "Entry cancelled · it stays crossed out under Payments and charges", at: Date.now() };
  });
}

// ---------- Move-out (SCR-50/51) ----------

export async function moveOutAction(_: FormState, fd: FormData): Promise<FormState> {
  const f = form(fd);
  const r = await guard(async () => {
    const ctx = await requireCtx();
    const cur = await tenancyCurrency(f.tenancyId);
    const deductions: cmd.Deduction[] = [];
    for (let i = 0; i < 10; i++) {
      if (!f[`dAmount${i}`]?.trim() && !f[`dReason${i}`]?.trim()) continue;
      deductions.push({
        category: z.enum(["DAMAGE", "CLEANING", "OTHER"]).parse(f[`dCategory${i}`]),
        amountMinor: money(f[`dAmount${i}`], cur, `dAmount${i}`, { required: true, positive: true }),
        reason: str(120).min(1, "Describe the deduction").parse(f[`dReason${i}`]),
      });
    }
    await cmd.finalizeMoveOut(ctx, {
      tenancyId: f.tenancyId,
      moveOut: date(f.moveOut, "moveOut"),
      deductions,
      refundNow: f.refundNow === "on",
      refundMethod: f.refundNow === "on" ? METHOD.parse(f.refundMethod) : "CASH",
      refundDate: f.refundNow === "on" ? date(f.refundDate, "refundDate") : f.moveOut,
    });
  });
  if (r) return r;
  revalidatePath("/", "layout");
  redirect(`/tenancies/${f.tenancyId}`);
}

// ---------- Tenant and tenancy changes (SCR-31, SCR-42 actions) ----------

const phone = opt(30).refine((v) => !v || /^[+\d\s()-]{5,30}$/.test(v), "Enter a valid phone number");

export async function updateTenantAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const v = z.object({
      fullName: str(120).min(1, "Enter the tenant's name"),
      phone, altPhone: phone,
      email: z.union([z.literal(""), z.email("Enter a valid email")]).optional().transform((x) => x || undefined),
      address: opt(300), emergencyName: opt(120), emergencyPhone: phone, notes: opt(2000),
    }).parse(f);
    await cmd.updateTenant(ctx, f.tenantId, v);
    revalidatePath("/", "layout");
    return { ok: "Tenant details saved", at: Date.now() };
  });
}

export async function updateTermsAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    await cmd.updateTerms(ctx, {
      tenancyId: f.tenancyId,
      leaseEndDate: f.leaseEnd ? date(f.leaseEnd, "leaseEnd") : undefined,
      graceDays: z.coerce.number({ error: "Enter days to pay" }).int().min(0, "0 to 60 days").max(60, "0 to 60 days").parse(f.graceDays || "0"),
      notes: opt(2000).parse(f.notes),
    });
    revalidatePath("/", "layout");
    return { ok: "Terms saved", at: Date.now() };
  });
}

export async function changeRentAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const cur = await tenancyCurrency(f.tenancyId);
    const n = await cmd.changeRent(ctx, {
      tenancyId: f.tenancyId,
      effectiveFrom: date(f.effectiveFrom, "effectiveFrom"),
      rentMinor: money(f.rent, cur, "rent", { required: true, positive: true }),
      reason: opt(200).parse(f.reason),
    });
    revalidatePath("/", "layout");
    return { ok: n ? `Rent changed · ${n} ${n === 1 ? "adjustment" : "adjustments"} added for months already charged` : "Rent changed", at: Date.now() };
  });
}

export async function giveNoticeAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    await cmd.giveNotice(ctx, {
      tenancyId: f.tenancyId,
      noticeDate: date(f.noticeDate, "noticeDate"),
      plannedMoveOut: date(f.plannedMoveOut, "plannedMoveOut"),
      givenBy: z.enum(["TENANT", "LANDLORD"]).parse(f.givenBy),
    });
    revalidatePath("/", "layout");
    return { ok: "Leaving date saved · shown at the top of this page. Rent stops after that date", at: Date.now() };
  });
}

export async function withdrawNoticeAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    await cmd.withdrawNotice(ctx, String(fd.get("tenancyId")));
    revalidatePath("/", "layout");
    return { ok: "Tenant is staying · monthly rent continues", at: Date.now() };
  });
}

// ---------- Expenses (SCR-72) ----------

export async function saveExpenseAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const db = await getDb();
    const propertyId = f.propertyId || undefined;
    let currency = ctx.workspace.defaultCurrency;
    if (propertyId) {
      const [p] = await db.select({ currency: t.properties.currency }).from(t.properties).where(eq(t.properties.id, propertyId));
      if (!p) throw new FieldError("propertyId", "Choose a property");
      currency = p.currency;
    }
    const input: cmd.ExpenseInput = {
      propertyId,
      unitId: propertyId ? f.unitId || undefined : undefined,
      category: z.enum(Object.keys(EXPENSE_CATEGORIES) as [string, ...string[]], "Choose a category").parse(f.category),
      amountMinor: money(f.amount, currency, "amount", { required: true, positive: true }),
      expenseDate: date(f.expenseDate, "expenseDate"),
      payee: opt(120).parse(f.payee),
      method: f.method ? METHOD.parse(f.method) : undefined,
      reference: opt(100).parse(f.reference),
      note: opt(500).parse(f.note),
    };
    // Optional receipt (SCR-72): checked before the expense is saved, so a bad file never leaves a half-done save.
    const file = fd.get("receipt");
    const receipt = file instanceof File && file.size ? new Uint8Array(await file.arrayBuffer()) : null;
    if (receipt) cmd.checkDocFile(receipt, "receipt");
    const id = f.id ? await cmd.updateExpense(ctx, f.id, input) : await cmd.addExpense(ctx, input);
    let note = "";
    if (receipt) {
      try {
        await cmd.addDocument(ctx, { entityType: "EXPENSE", entityId: id, category: "BILL", fileName: (file as File).name, bytes: receipt });
        note = " · receipt attached";
      } catch (e) {
        if (!(e instanceof cmd.DomainError)) throw e;
        note = ` · receipt not saved: ${e.message}`;
      }
    }
    revalidatePath("/", "layout");
    return { ok: `${f.id ? "Expense updated" : "Expense added"} · shown under Expenses${note}`, at: Date.now() };
  });
}

export async function voidExpenseAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    await cmd.voidExpense(ctx, f.id, str(200).min(1, "Enter a reason").parse(f.reason));
    revalidatePath("/", "layout");
    return { ok: "Expense cancelled · it stays crossed out under Expenses", at: Date.now() };
  });
}

// ---------- Meters and readings (SCR-60…63) ----------

const METER_TYPES = ["ELECTRICITY", "WATER", "GAS", "OTHER"] as const;
const UOMS = ["KWH", "M3", "LITRE", "UNIT"] as const;

function reading(value: string | undefined, field: string) {
  if (!value?.trim()) throw new FieldError(field, "Enter the reading");
  const v = parseScaled(value, 3);
  if (v === null) throw new FieldError(field, "Enter a number with up to 3 decimals");
  return v;
}

export async function saveMeterAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const db = await getDb();
    const [p] = await db.select({ currency: t.properties.currency }).from(t.properties).where(eq(t.properties.id, f.propertyId ?? ""));
    if (!p) throw new FieldError("", "Property not found");
    const rateE4 = parseScaled(f.rate ?? "", 4);
    if (rateE4 === null) throw new FieldError("rate", "Enter a rate with up to 4 decimals");
    if (rateE4 > 1_000_000 * 10_000) throw new FieldError("rate", "Rate is too high");
    const input: cmd.MeterInput = {
      propertyId: f.propertyId,
      unitId: f.unitId || undefined,
      type: z.enum(METER_TYPES, "Choose a type").parse(f.type),
      label: str(40).min(1, "Enter a name").parse(f.label),
      serialNumber: opt(60).parse(f.serialNumber),
      uom: z.enum(UOMS, "Choose what it is measured in").parse(f.uom),
      rateE4,
      fixedChargeMinor: money(f.fixed, p.currency, "fixed"),
    };
    if (f.id) await cmd.updateMeter(ctx, f.id, input);
    else await cmd.addMeter(ctx, input);
    revalidatePath("/", "layout");
    return { ok: f.id ? "Meter saved" : "Meter added", at: Date.now() };
  });
}

const billMessage = (r: Awaited<ReturnType<typeof cmd.recordReading>>) =>
  r.charged ? `Reading saved · ${formatMoney(r.charged, r.currency)} added to the tenant's balance under Payments and charges`
  : r.baseline ? "Saved as the starting reading for this tenant. The next reading will be billed."
  : r.vacant ? "Reading saved (no tenant to bill)" : "Reading saved";

export async function recordReadingAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const db = await getDb();
    const [m] = await db.select({ currency: t.meters.currency }).from(t.meters).where(eq(t.meters.id, f.meterId ?? ""));
    if (!m) throw new FieldError("", "Meter not found");
    const replaced = f.replaced === "on" ? { oldFinalMilli: reading(f.oldFinal, "oldFinal"), newStartMilli: reading(f.newStart || "0", "newStart") } : undefined;
    const r = await cmd.recordReading(ctx, {
      meterId: f.meterId,
      date: date(f.date, "date"),
      valueMilli: reading(f.value, "value"),
      replaced,
      bill: f.bill === "on",
      amountMinor: f.bill === "on" && f.amount?.trim() ? money(f.amount, m.currency, "amount", { positive: true }) : undefined,
      dueDate: f.bill === "on" && f.dueDate ? date(f.dueDate, "dueDate") : undefined,
      note: opt(200).parse(f.note),
    });
    revalidatePath("/", "layout");
    return { ok: billMessage(r), at: Date.now() };
  });
}

export async function voidReadingAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    await cmd.voidReading(ctx, f.id, str(200).min(1, "Enter a reason").parse(f.reason));
    revalidatePath("/", "layout");
    return { ok: "Reading cancelled · it stays crossed out in the meter history", at: Date.now() };
  });
}

/** F-UTIL-3: each meter is saved on its own, so one bad row doesn't block the rest. */
export async function readingsRoundAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const day = date(f.date, "date");
    const rows: Record<string, string> = {};
    let saved = 0, charges = 0;
    const totals = new Map<string, number>();
    for (const [k, v] of Object.entries(f)) {
      if (!k.startsWith("v_") || !v.trim()) continue;
      const meterId = k.slice(2);
      try {
        const r = await cmd.recordReading(ctx, { meterId, date: day, valueMilli: reading(v, k), bill: true });
        saved++;
        if (r.charged) { charges++; totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.charged); }
      } catch (e) {
        if (e instanceof cmd.DomainError || e instanceof FieldError) rows[meterId] = e.message;
        else throw e;
      }
    }
    if (saved) revalidatePath("/", "layout");
    if (!saved && !Object.keys(rows).length) throw new FieldError("", "Enter at least one reading");
    const amount = [...totals].map(([c, n]) => formatMoney(n, c)).join(" + ");
    const ok = saved ? `${saved} ${saved === 1 ? "reading" : "readings"} saved, ${charges} ${charges === 1 ? "bill" : "bills"} added to tenants' balances${amount ? ` (${amount})` : ""}` : undefined;
    return { ok, rows, error: Object.keys(rows).length ? `${Object.keys(rows).length} could not be saved. Check the highlighted rows.` : undefined, at: Date.now() };
  });
}

// ---------- Documents (SCR-75…77) ----------

export async function uploadDocumentAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    const f = form(fd);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) throw new FieldError("file", "Choose a file");
    const category = z.enum(Object.keys(DOC_CATEGORIES) as [string, ...string[]], "Choose what this is").parse(f.category);
    // On a tenancy, ID, address and police papers are filed under the tenant (personId) so they follow the person.
    const toPerson = PERSON_DOCS.includes(category) && f.personId;
    const entityType = toPerson ? "TENANT" : z.enum(["PROPERTY", "TENANT", "TENANCY"]).parse(f.entityType);
    const { sensitive } = await cmd.addDocument(ctx, {
      entityType, entityId: toPerson ? f.personId : f.entityId, category, title: opt(120).parse(f.title),
      fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()),
    });
    revalidatePath("/", "layout");
    return { ok: `Document added${sensitive ? " · marked sensitive" : ""} · shown under Documents`, at: Date.now() };
  });
}

export async function deleteDocumentAction(_: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const ctx = await requireCtx();
    await cmd.setDocumentDeleted(ctx, form(fd).id, true);
    revalidatePath("/", "layout");
    return { ok: "Document deleted · restore it from Recently deleted within 30 days", at: Date.now() };
  });
}

export async function restoreDocumentAction(fd: FormData) {
  const ctx = await requireCtx();
  await cmd.setDocumentDeleted(ctx, form(fd).id, false);
  revalidatePath("/", "layout");
}
