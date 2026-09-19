# 13 — Reports & Analytics Specification

```text
Version:      0.1
Status:       Draft — awaiting owner review
Last Updated: 2026-09-18
Depends On:   10_FINANCIAL_RULES.md, 05_DATABASE_DESIGN.md §6, 07_API_SPECIFICATION.md §3.13
Affected By:  16_DECISION_LOG.md
```

## 1. Rules that apply to every report

| Rule | Detail |
|---|---|
| Scope | Only properties the caller can access (01 §12). Workspace-level expenses appear only for all-properties members and only when the property filter is "All". |
| Currency | Never summed across currencies. Every total is per currency; tables with mixed currencies show a currency column and one total row per currency. |
| Dates | Business dates (`entry_date`, `due_date`, …) in the workspace time zone. "Today" = current date in the workspace time zone. |
| Voided entries | Excluded from all figures. Lists can show them with "Include voided" (struck through, not totalled). |
| Deposits | Liabilities, not income: excluded from Collected and Net cash; reported in the deposit register. |
| Internal transfers and opening balances | Excluded from Collected and from Collections totals by default (toggle to show). |
| As-of semantics | "As of D" means only entries with `entry_date ≤ D`, with FIFO recomputed on that subset (10 §3.2). |
| Archived records | Included in historical figures; excluded from "current" lists (e.g. vacancy) unless filtered. |
| Sources | `ledger_entries`, `v_charge_allocation` (05 §6.1) and the balance query (05 §6.2) on the server; the same formulas in the Android engine for on-device views. |
| Exports | CSV for every report (§14); PDF for statements, receipts and settlements (MVP); PDF/XLSX for other reports in V1. |

## 2. Dashboard (REP-001)

Parameters: `month` (default current), `property_ids` (default all accessible), `currency` (when several).

| Metric | Definition |
|---|---|
| Billed (month) | Σ CHARGE(RENT) with `entry_date` in month, excluding OPENING_BALANCE |
| Collected (month) | Σ PAYMENT(RENT) − Σ REFUND(RENT) with `entry_date` in month, excluding INTERNAL_TRANSFER |
| Collection rate (month) | For RENT-account charges (excluding OPENING_BALANCE) with `due_date` in month: Σ paid (FIFO, as of today) ÷ Σ amount. "—" if no such charges. |
| Outstanding | Σ max(rent_balance, 0) over tenancies (ACTIVE and ENDED). Current month: as of today. Past month: as of month end. |
| Overdue | Σ overdue amounts (10 §3.3) + count of tenancies with overdue > 0 (same as-of rule) |
| Advances held | Σ max(−rent_balance, 0) |
| Deposits held | Σ deposit_held |
| Expenses (month) | Σ ACTIVE expenses with `expense_date` in month |
| Net cash (month) | Collected (month) − Expenses (month) |
| Occupancy | Units with a non-cancelled tenancy whose occupancy contains today (or month end) ÷ non-archived units |

Lists:

| List | Content | Sort |
|---|---|---|
| Needs attention | Tenancies with overdue > 0: unit, tenant, overdue amount, days overdue | Oldest overdue first |
| Due in 7 days | Charges with remaining > 0 and today ≤ due_date ≤ today + 7 | Due date |
| Paid this month | Tenancies whose charges due in the month are all Paid | Unit label |
| Coming up | Planned move-outs ≤ 30 days; lease ends ≤ 30 days; deposits due | Date |

## 3. Rent roll (REP-002)

| Aspect | Specification |
|---|---|
| Purpose | Snapshot of every unit and what it earns |
| Source | units, tenancies (occupying `as_of`), rent_revisions, recurring_charges, balances |
| Parameters | `as_of` (default today), `property_ids`, `status` (occupied, vacant, on notice, upcoming) |
| Columns | Property · Unit · Status · Tenant(s) · Start date · Lease end · Current rent · Recurring monthly total · Deposit agreed · Deposit held · Balance · Overdue · Last payment (date, amount) |
| Calculations | Current rent = revision effective at `as_of`; balance and overdue as of `as_of` |
| Grouping | By property, with subtotals (rent, deposit held, balance, overdue) per currency |
| Sorting | Property name, then unit label (natural sort: Room 2 before Room 10) |
| Export | CSV |

## 4. Outstanding & aging (REP-003)

| Aspect | Specification |
|---|---|
| Purpose | Who owes what, and for how long |
| Source | `v_charge_allocation` as of `as_of` |
| Parameters | `as_of`, `property_ids`, `min_amount`, include ENDED tenancies (default yes) |
| Rows | Tenancies with balance > 0 as of `as_of` |
| Columns | Property · Unit · Tenant · Not yet due · 1–30 · 31–60 · 61–90 · 90+ · Total · Oldest due date · Last payment date · Phone |
| Calculations | Buckets per 10 §3.3 on remaining amounts |
| Grouping | Optional by property |
| Sorting | Total desc (default), oldest due date, unit |
| Export | CSV |

## 5. Collections (REP-004)

| Aspect | Specification |
|---|---|
| Purpose | What money came in (and went back) |
| Source | ledger_entries: PAYMENT and REFUND (both accounts) |
| Parameters | `from`, `to` (≤ 5 years), `property_ids`, `method`, `account` (rent/deposit/both), `recorded_by`, include voided, include transfers/opening |
| Columns | Date · Receipt no. · Tenant · Unit · Property · Account · Method · Reference · Amount (refunds negative) · Recorded by |
| Calculations | Totals per currency; rent and deposit totals shown separately |
| Grouping | none / day / month / property / method / account / member, with subtotals |
| Sorting | Date desc (default), amount, receipt number |
| Export | CSV |

## 6. Deposit register (REP-006)

| Aspect | Specification |
|---|---|
| Purpose | Money held on behalf of tenants |
| Source | DEPOSIT-account entries + DEPOSIT_APPLIED |
| Parameters | `as_of`, `property_ids`, `status` |
| Columns | Property · Unit · Tenant · Tenancy status · Agreed (charges − deposit credits) · Received · Applied · Refunded · **Held** · Due · Status (Collecting / Held / Refund due / Settled) |
| Grouping | By property with subtotals |
| Sorting | Held desc (default), unit |
| Export | CSV |

## 7. Tenant statement (REP-005)

| Aspect | Specification |
|---|---|
| Purpose | Complete, shareable history of one tenancy (dispute proof) |
| Source | ledger_entries of the tenancy |
| Parameters | `tenancy_id`, `from` (default start), `to` (default today), format (pdf/csv/json) |
| Layout | Header: landlord details, tenant(s), unit, property, statement period, generated at. **Opening balance** (as of from − 1). Entries: date, description, charges (debit), payments & credits (credit), running balance. **Closing balance**. Deposit section: agreed, received, applied, refunded, held. Appendix "Voided entries" (date, description, amount, reason). |
| Ordering | `entry_date` asc; same day: charges, then credits/payments/deposit applied, then refunds; then `created_at` |
| Calculations | Running balance on the RENT account only (10 §2.2) |
| Export | PDF, CSV; share via share sheet (F-REP-2) |

## 8. Expenses (REP-007)

| Aspect | Specification |
|---|---|
| Source | expenses (ACTIVE) |
| Parameters | `from`, `to`, `property_ids`, `category`, include workspace-level |
| Columns | Date · Property · Unit · Category · Payee · Method · Reference · Amount · Note |
| Grouping | none / month / property / category, with subtotals |
| Sorting | Date desc (default), amount |
| Export | CSV |

## 9. Property income summary (REP-008)

| Aspect | Specification |
|---|---|
| Purpose | How each property performs month by month |
| Parameters | `from`, `to` (whole months, ≤ 36), `property_ids` |
| Columns per property × month | Billed · Collected · Credits given · Expenses · **Net cash** · Occupancy % (month end) · Outstanding (month end) |
| Calculations | As §2, per property; credits = Σ CREDIT(RENT) in month |
| Grouping | Property rows with month columns, or month rows with property columns (toggle); extra row "Workspace-level expenses" |
| Sorting | Property name; months ascending |
| Export | CSV |

## 10. Vacancy (REP-009a)

| Aspect | Specification |
|---|---|
| Source | units (non-archived) without an occupying tenancy on `as_of` |
| Columns | Property · Unit · Type · Vacant since · Days vacant · Last rent · Upcoming tenancy start |
| Calculations | Vacant since = last `moved_out_on` + 1, or unit creation date if never let |
| Sorting | Days vacant desc |
| Export | CSV |

## 11. Lease expiry (REP-009b)

| Aspect | Specification |
|---|---|
| Source | ACTIVE tenancies with `lease_end_date` |
| Parameters | `from`, `to` (default next 90 days), include already expired |
| Columns | Property · Unit · Tenant · Lease end · Days left (negative = expired) · On notice? · Current rent |
| Sorting | Lease end asc |
| Export | CSV |

## 12. Version 1 reports

| Report | Definition |
|---|---|
| Utility consumption (REP-011) | Per meter per reading interval: dates, consumption, rate, amount billed, tenant; totals per property and month |
| Owner statement (OWN-002) | Per owner and period: for each co-owned property, collected, credits, expenses, net cash, and the owner's share (net × share_bps / 10000, rounded per 10 §17), with a total |
| PDF/XLSX exports, scheduled reports (REP-012) | Any report as PDF/XLSX; monthly email of chosen reports to Owner/Admin |

## 13. Full data export (REP-010)

A streaming ZIP with one CSV per entity, plus `README.txt` describing every column:

`workspace.csv, members.csv, owners.csv, properties.csv, property_owners.csv, units.csv, tenants.csv, tenancies.csv, tenancy_parties.csv, rent_revisions.csv, recurring_charges.csv, ledger_entries.csv, charge_allocation.csv, meters.csv, meter_readings.csv, expenses.csv, documents.csv (metadata only), inspections.csv, inspection_items.csv, settlements.csv`

Includes IDs for joining; includes voided rows (with status) so the export is a complete record. The export is audited. Document files are added in V1.

## 14. CSV conventions

- UTF-8 **with BOM** (so Excel opens non-Latin names and ₹ correctly), comma separator, RFC 4180 quoting, header row, CRLF line endings.
- Dates `YYYY-MM-DD`; timestamps ISO 8601 UTC.
- Money as two columns: `amount` (decimal string in major units with the currency's decimals, e.g. `15000.00`, `1500`, `12.500`) and `currency`.
- Enumerations as their codes (e.g. `BANK_TRANSFER`), with the README explaining them.
- File name: `<workspace-slug>_<report>_<from>_<to or as_of>.csv`.

## 15. Performance

- Reports use indexed ranges (05 §2.15 indexes) and the FIFO view per tenancy. Target: p95 < 2 s for a 2,000-unit workspace over 12 months.
- If the target is missed (measured in PERF-TEST-002), add the `tenancy_balances` cache and monthly aggregates (06 §15).
