// Examples from docs/10_FINANCIAL_RULES.md §3.4. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { allocate, formatMoney, type LedgerEntry } from "./money.ts";

const rent = (id: string, due: string, amount = 1_500_000): LedgerEntry => ({
  id, tenancyId: "t", account: "RENT", kind: "CHARGE", category: "RENT",
  amount, entryDate: due.slice(0, 8) + "01", dueDate: due, description: id,
});
const pay = (id: string, date: string, amount: number, voided = false): LedgerEntry => ({
  id, tenancyId: "t", account: "RENT", kind: "PAYMENT", amount, entryDate: date, description: id, voided,
});

test("FIN-TEST-002 partial payments", () => {
  const b = allocate([rent("sep", "2026-09-05"), pay("p1", "2026-09-03", 1_000_000)], "2026-09-06");
  assert.equal(b.charges[0].state, "PARTLY_PAID");
  assert.equal(b.overdue, 500_000);
  assert.equal(b.daysOverdue, 1);
});

test("FIN-TEST-003 one payment against arrears", () => {
  const b = allocate(
    [rent("sep", "2026-09-05"), rent("jul", "2026-07-05"), rent("aug", "2026-08-05"), pay("p", "2026-09-10", 2_000_000)],
    "2026-09-10",
  );
  assert.deepEqual(b.charges.map((c) => [c.entry.id, c.state, c.remaining]), [
    ["jul", "PAID", 0], ["aug", "PARTLY_PAID", 1_000_000], ["sep", "UNPAID", 1_500_000],
  ]);
  assert.equal(b.balance, 2_500_000);
});

test("FIN-TEST-004 advance", () => {
  const b = allocate([rent("sep", "2026-09-05"), pay("p", "2026-09-03", 4_500_000)], "2026-09-10");
  assert.equal(b.balance, -3_000_000);
  assert.equal(b.advance, 3_000_000);
});

test("FIN-TEST-005 voided payment is ignored", () => {
  const b = allocate(
    [rent("sep", "2026-09-05"), pay("p1", "2026-09-03", 1_000_000, true), pay("p2", "2026-09-20", 500_000)],
    "2026-09-21",
  );
  assert.equal(b.charges[0].remaining, 1_000_000);
});

test("formats per currency minor units", () => {
  assert.equal(formatMoney(15_000_00, "INR"), "₹15,000");
  assert.equal(formatMoney(1_50_000_00, "INR"), "₹1,50,000");
  assert.equal(formatMoney(1234, "JPY", "en-US"), "¥1,234");
});

import { moveOutCredit, parseMoney, periodStartFor, prorate, rentSchedule } from "./money.ts";

test("periods (10 §4.1)", () => {
  assert.equal(periodStartFor("2026-09-18", 1), "2026-09-01");
  assert.equal(periodStartFor("2026-09-10", 18), "2026-08-18");
});

test("FIN-TEST-008/009 first-period proration", () => {
  assert.equal(prorate(1_500_000, 13, 30, 100), 650_000);
  assert.equal(prorate(1_200_000, 19, 28, 100), 814_300);
  assert.equal(prorate(1_200_000, 20, 29, 100), 827_600);
});

test("FIN-TEST-011 cents rounding", () => {
  assert.equal(prorate(145_000, 12, 31, 1), 56_129);
});

test("FIN-TEST-010 move-out credit", () => {
  assert.equal(moveOutCredit(1_500_000, "2027-03-01", "2027-03-12", 1, 100), 919_400);
  assert.equal(moveOutCredit(1_500_000, "2026-11-18", "2026-12-02", 18, 100), 750_000);
  assert.equal(moveOutCredit(1_500_000, "2027-03-01", "2027-03-31", 1, 100), 0);
});

test("schedule: partial first period then full periods, idempotent keys", () => {
  const s = rentSchedule({
    tenancyId: "t", billingStart: "2026-09-18", cycleDay: 1, graceDays: 4, until: "2026-11-01", unit: 100, rentAt: () => 1_500_000,
  });
  assert.deepEqual(s.map((c) => [c.periodStart, c.dueDate, c.amount]), [
    ["2026-09-18", "2026-09-22", 650_000],
    ["2026-10-01", "2026-10-05", 1_500_000],
    ["2026-11-01", "2026-11-05", 1_500_000],
  ]);
  assert.equal(s[0].description, "Rent · 18 Sep – 30 Sep 2026 (13/30 days)");
  assert.equal(s[1].description, "Rent · Oct 2026");
  assert.equal(s[1].key, "rent:t:2026-10-01");
});

test("parseMoney", () => {
  assert.equal(parseMoney("15,000", "INR"), 1_500_000);
  assert.equal(parseMoney("12.5", "USD"), 1250);
  assert.equal(parseMoney("12.345", "USD"), null);
  assert.equal(parseMoney("1000", "JPY"), 1000);
  assert.equal(parseMoney("-5", "INR"), null);
});
