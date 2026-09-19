// Ledger maths from docs/10_FINANCIAL_RULES.md §3. Amounts are integer minor units.

export type Account = "RENT" | "DEPOSIT";
export type EntryKind = "CHARGE" | "PAYMENT" | "CREDIT" | "REFUND" | "DEPOSIT_APPLIED";

export interface LedgerEntry {
  id: string;
  tenancyId: string;
  account: Account;
  kind: EntryKind;
  category?: string; // 10 §2.1
  amount: number;
  entryDate: string; // YYYY-MM-DD
  dueDate?: string; // charges only
  description: string;
  method?: string;
  receiptNo?: string;
  voided?: boolean;
}

export type ChargeState = "PAID" | "PARTLY_PAID" | "UNPAID";

export interface AllocatedCharge {
  entry: LedgerEntry;
  paid: number;
  remaining: number;
  state: ChargeState;
  overdue: boolean;
}

export interface Balance {
  charges: AllocatedCharge[];
  balance: number; // > 0 owed, < 0 advance
  advance: number;
  overdue: number;
  daysOverdue: number;
  dueSoon: number;
  depositHeld: number;
  depositDue: number;
}

const RANK: Record<string, number> = { OPENING_BALANCE: 0, RENT: 1, UTILITY: 2 };
const rank = (c?: string) => RANK[c ?? ""] ?? 3;

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

export function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function allocate(all: LedgerEntry[], today: string, asOf?: string): Balance {
  const entries = all.filter((e) => !e.voided && (!asOf || e.entryDate <= asOf));
  const sum = (account: Account, ...kinds: EntryKind[]) =>
    entries.filter((e) => e.account === account && kinds.includes(e.kind)).reduce((s, e) => s + e.amount, 0);

  const charges = entries
    .filter((e) => e.account === "RENT" && e.kind === "CHARGE")
    .sort(
      (a, b) =>
        a.dueDate!.localeCompare(b.dueDate!) ||
        rank(a.category) - rank(b.category) ||
        a.id.toLowerCase().localeCompare(b.id.toLowerCase()),
    );

  const credits = sum("RENT", "PAYMENT", "CREDIT", "DEPOSIT_APPLIED") - sum("RENT", "REFUND");
  let pool = credits;
  const totalCharged = charges.reduce((s, c) => s + c.amount, 0);
  const soon = addDays(today, 7);

  const allocated = charges.map((entry): AllocatedCharge => {
    const paid = Math.min(Math.max(pool, 0), entry.amount);
    pool -= paid;
    const remaining = entry.amount - paid;
    return {
      entry,
      paid,
      remaining,
      state: remaining === 0 ? "PAID" : paid > 0 ? "PARTLY_PAID" : "UNPAID",
      overdue: remaining > 0 && entry.dueDate! < today,
    };
  });

  const overdueCharges = allocated.filter((c) => c.overdue);
  return {
    charges: allocated,
    balance: totalCharged - credits,
    advance: Math.max(pool, 0),
    overdue: overdueCharges.reduce((s, c) => s + c.remaining, 0),
    daysOverdue: overdueCharges.length ? daysBetween(overdueCharges[0].entry.dueDate!, today) : 0,
    dueSoon: allocated
      .filter((c) => c.remaining > 0 && c.entry.dueDate! >= today && c.entry.dueDate! <= soon)
      .reduce((s, c) => s + c.remaining, 0),
    depositHeld: sum("DEPOSIT", "PAYMENT") - sum("DEPOSIT", "REFUND") - sum("RENT", "DEPOSIT_APPLIED"),
    depositDue: sum("DEPOSIT", "CHARGE") - sum("DEPOSIT", "PAYMENT", "CREDIT"),
  };
}

// Same-day entries read naturally: what was charged, then what reduced it.
const KIND_ORDER: Record<EntryKind, number> = { CHARGE: 0, CREDIT: 1, DEPOSIT_APPLIED: 2, PAYMENT: 3, REFUND: 4 };

// Running balance per entry, oldest first (for the ledger tab).
export function runningBalances(entries: LedgerEntry[]) {
  const sign = (e: LedgerEntry) => (e.kind === "CHARGE" || e.kind === "REFUND" ? 1 : -1);
  let running = 0;
  return entries
    .filter((e) => e.account === "RENT")
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id))
    .map((e) => {
      if (!e.voided) running += sign(e) * e.amount;
      return { entry: e, running };
    });
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(minor: number, currency: string, locale = "en-IN") {
  const key = `${locale}|${currency}`;
  let f = formatters.get(key);
  if (!f) {
    // Minor-unit digits come from the currency itself (INR 2, JPY 0, KWD 3).
    const digits = new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
    f = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: digits });
    formatters.set(key, f);
  }
  const digits = f.resolvedOptions().maximumFractionDigits ?? 2;
  return f.format(minor / 10 ** digits);
}

// ---- Rent periods and proration (10 §4–§6) ----

const pad2 = (n: number) => String(n).padStart(2, "0");
const ym = (d: string) => [Number(d.slice(0, 4)), Number(d.slice(5, 7))] as const;
const onDay = (y: number, m: number, day: number) => {
  const d = new Date(Date.UTC(y, m - 1, day));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

/** Start of the rent period containing `date` for cycle day c (1–28). */
export function periodStartFor(date: string, c: number) {
  const [y, m] = ym(date);
  return Number(date.slice(8)) >= c ? onDay(y, m, c) : onDay(y, m - 1, c);
}

export const nextPeriodStart = (start: string, c: number) => {
  const [y, m] = ym(start);
  return onDay(y, m + 1, c);
};

/** Minor-unit exponent of a currency (INR 2, JPY 0, KWD 3). */
export const currencyDigits = (currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;

/** Rounding increment in minor units (10 §17). */
export const roundingUnit = (currency: string, wholeUnits: boolean) => (wholeUnits ? 10 ** currencyDigits(currency) : 1);

/** round_money(A × occupied / cycleDays), half-up, integer maths (10 §5.1). */
export function prorate(amountMinor: number, occupiedDays: number, cycleDays: number, unit: number) {
  const q = BigInt(amountMinor) * BigInt(occupiedDays);
  const d = BigInt(cycleDays) * BigInt(unit);
  return Number(((2n * q + d) / (2n * d)) * BigInt(unit));
}

/** Round a plain amount to the rounding increment (half-up). */
export const roundMoney = (minor: number, unit: number) => Math.floor((minor + unit / 2) / unit) * unit;

export interface PlannedCharge {
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: number;
  description: string;
  key: string;
}

// Stored descriptions use fixed English names so they never depend on server locale.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = (d: string) => `${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const DAYMON = (d: string) => `${Number(d.slice(8))} ${MON[Number(d.slice(5, 7)) - 1]}`;

/**
 * Rent charges for every period start in [billingStart, until] (10 §6).
 * `rentAt(s)` returns the rent in force at period start s (latest revision ≤ s).
 */
export function rentSchedule(opts: {
  tenancyId: string;
  billingStart: string;
  cycleDay: number;
  graceDays: number;
  until: string;
  unit: number;
  rentAt: (periodStart: string) => number;
}): PlannedCharge[] {
  const { tenancyId, billingStart, cycleDay: c, graceDays, until, unit, rentAt } = opts;
  const out: PlannedCharge[] = [];
  let s = billingStart;
  while (s <= until) {
    const fullStart = periodStartFor(s, c);
    const next = nextPeriodStart(fullStart, c);
    const end = addDays(next, -1);
    const rent = rentAt(s);
    const partial = s !== fullStart;
    const cycleDays = daysBetween(fullStart, next);
    const occupied = daysBetween(s, next);
    const label = c === 1 && !partial ? MONTH(s) : `${DAYMON(s)} – ${DAYMON(end)} ${end.slice(0, 4)}`;
    out.push({
      periodStart: s,
      periodEnd: end,
      dueDate: addDays(s, graceDays),
      amount: partial ? prorate(rent, occupied, cycleDays, unit) : rent,
      description: `Rent · ${label}${partial ? ` (${occupied}/${cycleDays} days)` : ""}`,
      key: `rent:${tenancyId}:${s}`,
    });
    s = next;
  }
  return out;
}

/** Credit for unused days of the period containing the move-out date (10 §5.3). */
export function moveOutCredit(amount: number, periodStart: string, moveOut: string, cycleDay: number, unit: number) {
  const fullStart = periodStartFor(periodStart, cycleDay);
  const next = nextPeriodStart(fullStart, cycleDay);
  if (moveOut >= addDays(next, -1)) return 0;
  const kept = prorate(amount, daysBetween(periodStart, moveOut) + 1, daysBetween(fullStart, next), unit);
  return Math.max(amount - kept, 0);
}

/** Parse user text like "15,000.50" into minor units; null if invalid or too precise (10 §17). */
export function parseMoney(text: string, currency: string): number | null {
  const clean = text.replace(/[,\s]/g, "");
  if (!/^\d{1,13}(\.\d+)?$/.test(clean)) return null;
  const digits = currencyDigits(currency);
  const [whole, frac = ""] = clean.split(".");
  if (frac.length > digits) return null;
  return Number(whole) * 10 ** digits + Number(frac.padEnd(digits, "0") || 0);
}

// ---- Utility charges (10 §11) ----

/** Parse a decimal string into an integer scaled by 10^scale ("4951.5", 3 → 4951500); null if invalid or too precise. */
export function parseScaled(text: string, scale: number): number | null {
  const clean = text.replace(/[,\s]/g, "");
  if (!/^\d{1,11}(\.\d+)?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  if (frac.length > scale) return null;
  return Number(whole) * 10 ** scale + Number(frac.padEnd(scale, "0") || 0);
}

/** Integer scaled by 10^scale back to a trimmed decimal string (4951500, 3 → "4951.5"). */
export const formatScaled = (n: number, scale: number) =>
  (n / 10 ** scale).toFixed(scale).replace(/\.?0+$/, "");

/**
 * round_money(consumption × rate × 10^exponent) + fixed (10 §11.2), in integers:
 * consumption in thousandths, rate in ten-thousandths of a major unit.
 */
export function utilityAmount(consumptionMilli: number, rateE4: number, fixedMinor: number, currency: string, unit: number) {
  const n = BigInt(consumptionMilli) * BigInt(rateE4) * 10n ** BigInt(currencyDigits(currency));
  const d = 10n ** 7n * BigInt(unit);
  return Number(((2n * n + d) / (2n * d)) * BigInt(unit)) + fixedMinor;
}

/** "Electricity 18 Aug – 18 Sep 2026: 219.5 kWh × ₹9.50" with fixed English month names. */
export function utilityDescription(type: string, from: string, to: string, consumptionMilli: number, uom: string, rate: string) {
  const name = { ELECTRICITY: "Electricity", WATER: "Water", GAS: "Gas" }[type] ?? "Utility";
  const u = { KWH: "kWh", M3: "m³", LITRE: "L", UNIT: "units" }[uom] ?? uom;
  return `${name} ${DAYMON(from)} – ${DAYMON(to)} ${to.slice(0, 4)}: ${formatScaled(consumptionMilli, 3)} ${u} × ${rate}`;
}
