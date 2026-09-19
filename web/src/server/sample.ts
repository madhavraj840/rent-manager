import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { currencyDigits } from "@/lib/money";
import { unitLabels } from "@/lib/units";
import * as cmd from "./commands";

/** Month start `offset` months from today's month, on `day`. */
const monthDay = (today: string, offset: number, day = 1) => {
  const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + offset, day));
  return d.toISOString().slice(0, 10);
};

/** Builds a demo portfolio through the real commands, dated relative to today. Empty workspaces only. */
export async function seedSample(ctx: cmd.Ctx) {
  const db = await getDb();
  const [any] = await db.select({ id: t.properties.id }).from(t.properties).where(eq(t.properties.workspaceId, ctx.workspace.id)).limit(1);
  if (any) throw new cmd.DomainError("NOT_EMPTY", "Sample data can only be added to an empty workspace.");

  const cur = ctx.workspace.defaultCurrency;
  const r = (major: number) => major * 10 ** currencyDigits(cur);
  const country = ctx.workspace.countryCode;
  const m = (offset: number, day = 1) => monthDay(ctx.today, offset, day);

  const green = await cmd.createProperty(ctx, { name: "Green View Apartments", type: "RESIDENTIAL_BUILDING", addressLine1: "14 5th Cross, HSR Layout", city: "Bengaluru", countryCode: country, currency: cur });
  const pg = await cmd.createProperty(ctx, { name: "Lake Road PG", type: "PG_HOSTEL", addressLine1: "22 Lake Road, Koramangala", city: "Bengaluru", countryCode: country, currency: cur });
  const house = await cmd.createProperty(ctx, { name: "Sunrise House", type: "INDEPENDENT_HOUSE", addressLine1: "8 Temple Street, Gokulam", city: "Mysuru", countryCode: country, currency: cur });

  await cmd.addUnits(ctx, green, ["101", "102", "103", "201", "202", "203", "301", "302"].map((n) => ({
    label: `Flat ${n}`, type: "FLAT", floorLabel: `Floor ${n[0]}`, defaultRentMinor: r(n.endsWith("3") ? 28000 : 22000), defaultDepositMinor: r(66000),
  })));
  await cmd.addUnits(ctx, pg, unitLabels("Room {n}", 6, 1).map((label) => ({ label, type: "ROOM", defaultRentMinor: r(8500), defaultDepositMinor: r(17000) })));
  await cmd.addUnits(ctx, house, [{ label: "Whole house", type: "HOUSE", defaultRentMinor: r(18000) }]);

  const units = await db.select().from(t.units).where(eq(t.units.workspaceId, ctx.workspace.id));
  const unit = (label: string) => units.find((u) => u.label === label)!.id;

  type Pay = [monthOffset: number, day: number, amount: number, method: string];
  const plans: { unit: string; name: string; phone: string; co?: string[]; start: string; rent: number; deposit: number; cycle?: number; grace?: number; lease?: string; pays: Pay[]; depositPaid?: number }[] = [
    { unit: "Flat 101", name: "Rahul Verma", phone: "+91 98450 12345", start: m(-3), rent: 22000, deposit: 66000, lease: m(1, 28), pays: [[-3, 3, 22000, "UPI"], [-2, 4, 22000, "UPI"], [-1, 3, 22000, "UPI"], [0, 3, 22000, "UPI"]] },
    { unit: "Flat 102", name: "Ananya Iyer", phone: "+91 99001 22334", start: m(-3), rent: 22000, deposit: 66000, pays: [[-3, 5, 22000, "BANK_TRANSFER"], [-2, 5, 22000, "BANK_TRANSFER"], [-1, 5, 22000, "BANK_TRANSFER"], [0, 8, 12000, "BANK_TRANSFER"]] },
    { unit: "Flat 103", name: "Mohammed Faiz", co: ["Rohan Das"], phone: "+91 90080 55667", start: m(-2), rent: 28000, deposit: 84000, pays: [[-2, 6, 28000, "CASH"], [-1, 20, 10000, "CASH"]] },
    { unit: "Flat 201", name: "Priya Nair", phone: "+91 97410 88990", start: m(-3, 10), rent: 22000, deposit: 60000, cycle: 10, grace: 0, pays: [[-3, 10, 22000, "UPI"], [-2, 9, 22000, "UPI"], [-1, 9, 44000, "UPI"]] },
    { unit: "Flat 202", name: "Karan Mehta", phone: "+91 98860 44321", start: m(-3), rent: 21000, deposit: 63000, lease: m(0, 28), pays: [[-3, 4, 21000, "CHEQUE"], [-2, 5, 21000, "CHEQUE"], [-1, 5, 21000, "CHEQUE"]] },
    { unit: "Flat 301", name: "Sneha Kulkarni", phone: "+91 96320 77889", start: m(-2), rent: 22500, deposit: 67500, depositPaid: 50000, pays: [[-2, 2, 22500, "UPI"], [-1, 3, 22500, "UPI"], [0, 4, 22500, "UPI"]] },
    { unit: "Room 1", name: "Arjun Reddy", phone: "+91 99459 11223", start: m(-3), rent: 8500, deposit: 17000, grace: 5, pays: [[-3, 5, 8500, "CASH"], [-2, 6, 8500, "CASH"], [-1, 6, 8500, "CASH"], [0, 6, 8500, "CASH"]] },
    { unit: "Room 2", name: "Divya Menon", phone: "+91 90350 66778", start: m(-3), rent: 8500, deposit: 17000, grace: 5, pays: [[-3, 6, 8500, "UPI"], [-2, 10, 8500, "UPI"], [-1, 7, 8500, "UPI"]] },
    { unit: "Room 4", name: "Vikram Joshi", phone: "+91 98440 33445", start: m(-1, 18), rent: 9000, deposit: 18000, grace: 5, pays: [[0, 2, 5000, "UPI"]] },
  ];

  for (const p of plans) {
    const id = await cmd.startTenancy(ctx, {
      unitId: unit(p.unit), tenant: { fullName: p.name, phone: p.phone }, coTenants: p.co ?? [], startDate: p.start, existing: false,
      cycleDay: p.cycle ?? 1, graceDays: p.grace ?? 4, rentMinor: r(p.rent), depositMinor: r(p.deposit), depositHeldMinor: 0,
      openingOwedMinor: 0, openingAdvanceMinor: 0, leaseEndDate: p.lease,
    });
    await cmd.recordPayment(ctx, { tenancyId: id, rentMinor: 0, depositMinor: r(p.depositPaid ?? p.deposit), date: p.start, method: "BANK_TRANSFER" });
    for (const [off, day, amount, method] of p.pays) {
      const d = m(off, day);
      if (d <= ctx.today) await cmd.recordPayment(ctx, { tenancyId: id, rentMinor: r(amount), depositMinor: 0, date: d, method });
    }
  }

  // A tenant who lived there before the app: opening balance and deposit already held (SCR-41).
  await cmd.startTenancy(ctx, {
    unitId: unit("Whole house"), tenant: { fullName: "Lakshmi Rao", phone: "+91 97390 99001" }, coTenants: [], startDate: m(-15, 15),
    existing: true, billingStart: m(-1), cycleDay: 1, graceDays: 5, rentMinor: r(18000), depositMinor: r(50000), depositHeldMinor: r(50000),
    openingOwedMinor: r(9000), openingAdvanceMinor: 0,
  });

  // Electricity meters: last month's reading is each tenant's starting point, this month's is billed at ₹9.50/kWh.
  const flats = units.filter((u) => u.propertyId === green);
  for (const [i, u] of flats.entries()) {
    const meterId = await cmd.addMeter(ctx, { propertyId: green, unitId: u.id, type: "ELECTRICITY", label: "Main meter", uom: "KWH", rateE4: 95000, fixedChargeMinor: 0 });
    const start = 4732000 + i * 611500; // thousandths of a kWh
    await cmd.recordReading(ctx, { meterId, date: m(-1, 1), valueMilli: start, bill: true });
    if (m(0, 1) <= ctx.today) await cmd.recordReading(ctx, { meterId, date: m(0, 1), valueMilli: start + 219500 + i * 23000, bill: true });
  }
  const common = await cmd.addMeter(ctx, { propertyId: pg, type: "ELECTRICITY", label: "Common area", uom: "KWH", rateE4: 95000, fixedChargeMinor: 0 });
  await cmd.recordReading(ctx, { meterId: common, date: m(-1, 1), valueMilli: 12040000, bill: false });

  // Running costs, so the dashboard shows net income.
  const costs: [string | undefined, string, number, string, number, number][] = [
    [green, "MAINTENANCE", 6500, "Lift AMC · Otis", -1, 5], [green, "UTILITY", 3200, "BESCOM common area", -1, 12],
    [pg, "SALARY", 12000, "Cook · Lakshmamma", -1, 1], [green, "REPAIR", 1800, "Ravi Plumbing", 0, 3],
    [pg, "SALARY", 12000, "Cook · Lakshmamma", 0, 1], [pg, "UTILITY", 4100, "BESCOM", 0, 10], [undefined, "OTHER", 950, "Accounting app", 0, 2],
  ];
  for (const [propertyId, category, amount, payee, offset, day] of costs) {
    const d = m(offset, day);
    if (d <= ctx.today) await cmd.addExpense(ctx, { propertyId, category, amountMinor: r(amount), expenseDate: d, payee, method: "UPI" });
  }

  // One mistaken duplicate that was voided.
  const [room2] = await db.select().from(t.tenancies).where(and(eq(t.tenancies.workspaceId, ctx.workspace.id), eq(t.tenancies.unitId, unit("Room 2"))));
  const res = await cmd.recordPayment(ctx, { tenancyId: room2.id, rentMinor: r(8500), depositMinor: 0, date: m(-1, 7), method: "UPI" });
  const [dup] = await db.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.receiptNumber, res.receipts[0]));
  await cmd.voidEntry(ctx, { entryId: dup.id, reason: "Entered twice" });
}
