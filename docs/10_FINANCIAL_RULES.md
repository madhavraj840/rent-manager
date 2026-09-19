# 10 — Financial & Business Rules

```text
Version:      0.1
Status:       Draft — awaiting owner review (D-021, D-022 need confirmation)
Last Updated: 2026-09-18
Depends On:   01_PRD.md (BR-001…BR-026), 04_DOMAIN_MODEL.md
Implemented:  05_DATABASE_DESIGN.md §6 (SQL), Android domain/ (Kotlin), server/domain (TypeScript)
Affected By:  16_DECISION_LOG.md; any change here requires updating spec/financial-vectors.json
```

This document is the **only** definition of money calculations. The server (SQL view + TypeScript) and the Android app (Kotlin) must implement it exactly. Both run the same test vectors (§19). If code and this document disagree, the code is wrong.

## 1. Principles

1. **Integer minor units.** Amounts are stored and computed as integers of the currency's minor unit (paise, cents). Rates and meter values are exact decimals. Binary floating point is never used for money.
2. **Append-only.** Entries are never edited or deleted, only voided (BR-009). Every figure can be recomputed from the ledger.
3. **Derived, not stored.** Balances, statuses, deposit figures and aging are computed from ACTIVE entries every time.
4. **Deterministic.** The same entries always give the same result on every device, whatever the order they were synced in.
5. **One currency per tenancy.** Figures are never summed across currencies.
6. **Proposals, then confirmation.** The app proposes calculated amounts (proration, utilities, settlement). The user may edit them before they are saved (D-040). Saved entries are facts.

## 2. Ledger model

Each tenancy has one ledger with two accounts:

- **RENT account**: rent and every other charge the tenant owes, plus payments, credits and refunds against them.
- **DEPOSIT account**: the security deposit agreed, collected and returned.

### 2.1 Allowed entry combinations

| Kind | Account | Categories | Method | Receipt no. | Effect |
|---|---|---|---|---|---|
| CHARGE | RENT | RENT, UTILITY, LATE_FEE, MAINTENANCE, PARKING, DAMAGE, CLEANING, TAX, OPENING_BALANCE, OTHER | — | — | + rent balance |
| CHARGE | DEPOSIT | DEPOSIT | — | — | + deposit due |
| PAYMENT | RENT | — | CASH, BANK_TRANSFER, UPI, CHEQUE, CARD, MOBILE_WALLET, OTHER, INTERNAL_TRANSFER | yes (not INTERNAL_TRANSFER) | − rent balance |
| PAYMENT | DEPOSIT | — | user methods, OPENING_BALANCE, INTERNAL_TRANSFER | yes (not OPENING_BALANCE / INTERNAL_TRANSFER) | − deposit due, + deposit held |
| CREDIT | RENT | DISCOUNT, WAIVER, PRORATION, ADJUSTMENT, WRITE_OFF, OPENING_ADVANCE | — | — | − rent balance |
| CREDIT | DEPOSIT | ADJUSTMENT | — | — | − deposit due (reduce the agreed deposit before it is collected) |
| REFUND | RENT | — | user methods, INTERNAL_TRANSFER | — | + rent balance (returns advance credit) |
| REFUND | DEPOSIT | — | user methods, INTERNAL_TRANSFER | — | − deposit held |
| DEPOSIT_APPLIED | RENT (by convention) | — | — | — | − rent balance **and** − deposit held |

Only ACTIVE entries count. VOID entries are ignored by every formula below.

### 2.2 Core formulas

```text
rent_balance   = Σ CHARGE(RENT) + Σ REFUND(RENT)
               − Σ PAYMENT(RENT) − Σ CREDIT(RENT) − Σ DEPOSIT_APPLIED
                 (> 0: tenant owes · < 0: advance credit = −rent_balance)

deposit_due    = Σ CHARGE(DEPOSIT) − Σ PAYMENT(DEPOSIT) − Σ CREDIT(DEPOSIT)
deposit_held   = Σ PAYMENT(DEPOSIT) − Σ REFUND(DEPOSIT) − Σ DEPOSIT_APPLIED      (never < 0)
```

The master prompt's formula maps to this model as follows:

```text
  Rent Due                       (CHARGE RENT/RENT)
+ Other Charges                  (CHARGE RENT/MAINTENANCE, PARKING, DAMAGE, CLEANING, TAX, OTHER, OPENING_BALANCE)
+ Utility Charges                (CHARGE RENT/UTILITY)
+ Late Fees                      (CHARGE RENT/LATE_FEE)
+ Refunds of advance             (REFUND RENT)
− Payments                       (PAYMENT RENT)
− Credits                        (CREDIT RENT: discounts, waivers, proration, adjustments, write-offs, opening advance)
− Deposit applied                (DEPOSIT_APPLIED)
= Outstanding Balance            (rent_balance)
```

## 3. Allocation (FIFO) and charge status

### 3.1 Rule
All credits on the RENT account settle RENT-account charges **oldest due first**. The "pool" is money received plus credits minus refunds. Payments are not tied to a specific charge. This keeps offline entry conflict-free: a payment recorded before its month's charge exists simply applies when the charge arrives.

### 3.2 Algorithm
```text
input: ACTIVE entries of one tenancy; optional as_of date; today (workspace time zone)
if as_of given: keep only entries with entry_date ≤ as_of
charges = CHARGE entries on RENT, sorted by (due_date ASC, rank(category) ASC, id ASC)
          rank: OPENING_BALANCE = 0, RENT = 1, UTILITY = 2, all others = 3
pool    = Σ PAYMENT(RENT) + Σ CREDIT(RENT) + Σ DEPOSIT_APPLIED − Σ REFUND(RENT)
for each charge c in order:
    paid(c)      = min(max(pool, 0), c.amount)
    remaining(c) = c.amount − paid(c)
    pool         = pool − paid(c)
advance = max(pool, 0)
```
`id` is the entry UUID compared as a lowercase string. It only breaks exact ties and makes the order identical on all devices.

### 3.3 Derived values
| Value | Definition |
|---|---|
| Charge state | PAID if remaining = 0; PARTLY_PAID if 0 < remaining < amount; UNPAID if remaining = amount |
| Overdue (charge) | remaining > 0 and due_date < today |
| Overdue amount (tenancy) | Σ remaining of overdue charges |
| Due soon | Σ remaining of charges with today ≤ due_date ≤ today + 7 |
| Days overdue | today − oldest overdue charge's due_date |
| Amount prefilled in "Record payment" | max(rent_balance, 0) |
| Aging bucket (as of D) | days = D − due_date for charges with remaining > 0: ≤ 0 → Not due; 1–30; 31–60; 61–90; > 90 |

### 3.4 Examples (₹, rent 15,000, due on the 5th)

**A. Partial payments (FIN-TEST-002)**
| Date | Entry | Pool | Sep charge |
|---|---|---|---|
| 1 Sep | Rent Sep 15,000 (due 5 Sep) | — | Unpaid |
| 3 Sep | Payment 10,000 | 10,000 | Partly paid, 5,000 left |
| 6 Sep | (today > due) | | Partly paid, **Overdue 5,000** |
| 20 Sep | Payment 5,000 | 15,000 | Paid; balance 0 |

**B. One payment against arrears (FIN-TEST-003)**
Charges: Jul 15,000, Aug 15,000, Sep 15,000. On 10 Sep the tenant pays 20,000.
FIFO: Jul paid 15,000 (Paid); Aug paid 5,000 (Partly paid, 10,000 left); Sep paid 0 (Unpaid).
Balance 25,000. Aging as of 10 Sep: Aug 10,000 is 36 days past due (31–60); Sep 15,000 is 5 days past due (1–30).

**C. Advance (FIN-TEST-004)**
Only the Sep charge exists. The tenant pays 45,000 on 3 Sep, so the balance is −30,000 ("Advance ₹30,000").
On 1 Oct the Oct charge is generated: it is Paid and the advance is 15,000. On 1 Nov the Nov charge is Paid and the advance is 0.
If the rent rises to 16,500 from Nov: Nov paid 15,000, 1,500 left.

**D. Void (FIN-TEST-005/006)**
From A, voiding the 10,000 payment makes Sep Unpaid again (pool 5,000 → Partly paid, 10,000 left).
Voiding the Sep charge instead turns the pool of 15,000 into an advance applied to Oct.

## 4. Rent periods

### 4.1 Cycle day and periods
- `cycle_day` c ∈ 1…28 (days 29–31 are not allowed, so every month has the day).
- The period containing date d starts on day c of d's month if day(d) ≥ c, otherwise on day c of the previous month. It ends the day before the next start.
- `grace_days` g ∈ 0…60. **Due date = period start + g.** Overdue from the day after.

| Setup | Period | Due date |
|---|---|---|
| Calendar, c = 1, g = 4 | 1–30 Sep 2026 | 5 Sep 2026 |
| Anniversary, c = 18, g = 0 | 18 Sep – 17 Oct 2026 | 18 Sep 2026 |
| Rent in arrears, c = 1, g = 34 | 1–30 Sep 2026 | 5 Oct 2026 |

### 4.2 First period of a tenancy
- If `billing_start_date` falls on a cycle start, the first period is a full period.
- Otherwise the first period is **partial**: from billing start to the day before the next cycle start. Its due date is billing start + g.
- Existing (digitized) tenancies always use a billing start on a cycle start (F-TNCY-2), so they have no partial first period.
- "Same as move-in day" billing with move-in on the 29th–31st uses c = 28 and a short first partial period.

## 5. Proration

### 5.1 Formula
```text
prorate(A, occupied_days, cycle_days) = round_money(A × occupied_days / cycle_days)
```
- `cycle_days` = number of days of the full period that contains the partial period (28–31).
- `occupied_days` counts both ends (move-in day and move-out day are occupied days).
- `round_money` per §17: half-up to whole currency units (default) or to minor units.

Integer implementation (all values positive, `unit` = 10^exponent when rounding to whole units, else 1):
```text
q = A_minor × occupied_days
d = cycle_days × unit
result_minor = ((2 × q + d) div (2 × d)) × unit
```

### 5.2 First-period examples
| Case | Calculation | Result |
|---|---|---|
| Rent ₹15,000, move-in 18 Sep 2026, c = 1 (FIN-TEST-008) | Sep has 30 days; 18–30 Sep = 13 days; 15,000 × 13 / 30 = 6,500 | **₹6,500**, due 22 Sep |
| Rent ₹12,000, move-in 10 Feb 2027, c = 1 (FIN-TEST-009) | Feb 2027 = 28 days; 10–28 Feb = 19; 12,000 × 19 / 28 = 8,142.86 | **₹8,143** |
| Same in leap year, 10 Feb 2028 | 29 days; 20 occupied; 12,000 × 20 / 29 = 8,275.86 | **₹8,276** |
| USD, rounding to cents, rent $1,450.00, move-in 20 Mar 2027 (FIN-TEST-011) | 12 / 31 × 1,450 = 561.290… | **$561.29** |

### 5.3 Last period (move-out)
The full charge for the period containing the move-out date was generated at period start. Settlement (§10) proposes a **PRORATION credit**:
```text
credit = A − prorate(A, occupied_days, cycle_days)     occupied_days = move-out date − period start + 1
```
| Case | Calculation | Credit |
|---|---|---|
| Rent ₹15,000, move-out 12 Mar 2027, c = 1 (FIN-TEST-010) | kept = 15,000 × 12 / 31 = 5,806.45 → 5,806 | **₹9,194** |
| Anniversary c = 18, rent ₹15,000, move-out 2 Dec 2026 | period 18 Nov–17 Dec (30 days); 15 occupied → kept 7,500 | **₹7,500** |
| Move-out on the period's last day | full period used | ₹0 (no line) |

Charges for periods that start **after** the move-out date are proposed for voiding. Local practice varies (e.g. "full month if notice not served"), so the landlord can remove or change any proposed line (D-040).

## 6. Charge generation

For each tenancy with status ACTIVE (FL-08):

```text
end = moved_out_on ?? planned_move_out_date ?? +∞
for each period start s with billing_start_date ≤ s ≤ min(today, end):
    key = "rent:" + tenancy_id + ":" + s
    if no entry with this generated_key exists (in any status):
        R = rent_minor of the revision with the greatest effective_from ≤ s
        amount = partial(s) ? prorate(R, …) : R
        insert CHARGE(RENT, RENT) amount, entry_date = s, due_date = s + g,
               period_start = s, period_end = next_start − 1, source = AUTO, key
    for each recurring charge r active at s (effective_from ≤ s ≤ effective_to or open):
        key_r = "rec:" + r.id + ":" + s     → same pattern, category = r.category, amount prorated if partial
```

- Descriptions: "Rent · Oct 2026" for calendar periods, "Rent · 18 Oct – 17 Nov 2026" otherwise, and "(13/30 days)" suffix for prorated periods.
- The tenancy-start operation creates the charges for all periods with start ≤ today using the same keys (possibly with user-edited amounts). The job therefore never duplicates them (FIN-TEST-014, RENT-TEST-001…006).

## 7. Rent changes (revisions)

- `effective_from` must be the billing start (initial rent) or a later period start (PERIOD_NOT_ALIGNED otherwise).
- Periods starting on or after `effective_from` use the new rent from then on.
- **Already generated periods are never edited.** For each ACTIVE generated rent charge with `period_start ≥ effective_from`, the app proposes an adjustment:

```text
diff = R_new − charge.amount
diff > 0 → CHARGE(RENT, RENT) diff, source REVISION, "Rent adjustment · Aug 2026 (₹15,000 → ₹16,500)"
diff < 0 → CREDIT(RENT, ADJUSTMENT) |diff|
entry_date = today; due_date = max(charge.due_date, today); related_entry_id = charge.id
generated_key = "revadj:" + revision_id + ":" + period_start
```

**Example (FIN-TEST-013):** rent 15,000 → 16,500 effective 1 Aug 2026, entered on 10 Sep. The Aug and Sep charges (15,000 each) exist, so the proposals are +1,500 (Aug) and +1,500 (Sep), both due 10 Sep. October is generated at 16,500. The user may delete the proposals (e.g. if they agreed the increase applies from October only; then they should choose 1 Oct as the effective date instead).

## 8. Security deposit

| Operation | Entry | Validation |
|---|---|---|
| Deposit agreed at start | CHARGE(DEPOSIT, DEPOSIT) = agreed, due on move-in date | ≥ 0 (0 = no entry) |
| Collect (in parts) | PAYMENT(DEPOSIT) | amount ≤ deposit_due (else `DEPOSIT_EXCEEDS_DUE`: prevents recording the same deposit twice) |
| Increase | CHARGE(DEPOSIT) "Deposit increase" | > 0 |
| Reduce before collection | CREDIT(DEPOSIT, ADJUSTMENT) | ≤ deposit_due |
| Reduce after collection | REFUND(DEPOSIT) | ≤ deposit_held |
| Use for dues (any time) | DEPOSIT_APPLIED | ≤ min(deposit_held, max(rent_balance, 0)) |
| Return | REFUND(DEPOSIT) | ≤ deposit_held |

**Example (FIN-TEST-015):** agreed 30,000 → paid 20,000 (18 Sep) → due 10,000, held 20,000 → paid 10,000 (3 Oct) → due 0, held 30,000 → increase 5,000 with a rent revision → due 5,000 → paid → held 35,000 → settlement applies 10,446 and refunds 24,554 → held 0.

Deposits are **liabilities**, not income. They are excluded from "Collected" and "Net cash" (13 §2) and shown separately.

## 9. Opening balances (existing tenancies)

Created by the existing-tenancy operation (F-TNCY-2), with `ob = billing_start_date − 1 day`:

| Input | Entry |
|---|---|
| Tenant owes A | CHARGE(RENT, OPENING_BALANCE) A, entry_date = due_date = ob, source OPENING |
| Tenant paid ahead B | CREDIT(RENT, OPENING_ADVANCE) B, entry_date = ob |
| Deposit agreed D | CHARGE(DEPOSIT, DEPOSIT) D, entry_date = due_date = ob |
| Deposit already held H (≤ D) | PAYMENT(DEPOSIT) H, method OPENING_BALANCE, entry_date = ob, no receipt |

**Example (FIN-TEST-017):** tenancy since Jan 2024, billing start 1 Oct 2026, arrears ₹20,000, deposit 30,000 fully held, rent 15,000.
Ledger: 30 Sep opening balance 20,000 (overdue from 1 Oct); deposit charge 30,000 + deposit payment 30,000; 1 Oct rent 15,000.
On 1 Oct the balance is 35,000, of which 20,000 is overdue, and deposit held is 30,000.

## 10. Move-out settlement

### 10.1 Algorithm
Input: tenancy ENDED with `moved_out_on` = M; its ACTIVE entries; MOVE_OUT readings; user deductions; refund choices.

```text
1. VOID proposals: generated rent/recurring charges with period_start > M
2. PRORATION credits for generated charges whose period contains M and ends after M (§5.3)
3. UTILITY charges from each unit meter's MOVE_OUT reading vs the previous reading in this tenancy (§11)
4. DEDUCTIONS: CHARGE(RENT, DAMAGE | CLEANING | OTHER) with reason (+ photos)
5. B  = rent_balance with 1–4 applied;   H = deposit_held
6. apply = min(H, max(B, 0))                     → DEPOSIT_APPLIED apply (if > 0)
7. B' = B − apply;   H' = H − apply
   refund_due  = H' + max(−B', 0)               (remaining deposit + advance credit)
   amount_owed = max(B', 0)
8. Optional refunds now: REFUND(DEPOSIT) ≤ H', REFUND(RENT) ≤ max(−B', 0)
9. Finalize atomically; tenancy → CLOSED if rent_balance = 0 and deposit_held = 0 after 8, else ENDED
```
The server recomputes steps 5–9 at finalize and compares with the client's `expected` totals (SETTLEMENT_STALE if different, 07 §4.5).

### 10.2 Worked example: refund (FIN-TEST-018)
Rent ₹15,000 (c = 1, g = 4), deposit ₹30,000 held, electricity ₹9.50/kWh. All months up to Feb are paid; the March charge (15,000) is unpaid. Move-out on 12 Mar 2027.

| Step | Line | Amount | Rent balance |
|---|---|---|---|
| start | March rent unpaid | | 15,000 |
| 1 | No charges after 12 Mar (April not generated) | — | 15,000 |
| 2 | Proration credit: kept 12/31 → 5,806 | −9,194 | 5,806 |
| 3 | Electricity: 6,140.0 − 6,020.0 = 120 kWh × 9.50 | +1,140 | 6,946 |
| 4 | Damage: broken window | +2,500 | 9,446 |
| 4 | Cleaning | +1,000 | 10,446 |
| 6 | Deposit applied = min(30,000, 10,446) | −10,446 | 0 |
| 7 | Refund due = 30,000 − 10,446 | **19,554** | |
| 8 | Refund by bank transfer on 14 Mar | deposit held 0 | |
| 9 | Both zero → **CLOSED** | | |

### 10.3 Tenant owes more than the deposit (FIN-TEST-019)
Feb and Mar unpaid (30,000), damage 12,000, electricity 1,140, proration −9,194. So B = 33,946 and H = 30,000 → apply 30,000 → **tenant owes ₹3,946**. The tenancy stays ENDED. A later payment of 3,946, or a WRITE_OFF credit, brings the balance to 0 and closes it.

### 10.4 Tenant has advance credit (FIN-TEST-020)
The tenant paid March in full and had ₹5,000 advance: before settlement B = −5,000. Proration −9,194 gives −14,194, and electricity +1,140 gives −13,054. Apply = 0. Refund due = 30,000 + 13,054 = **₹43,054**, recorded as REFUND(DEPOSIT) 30,000 + REFUND(RENT) 13,054.

### 10.5 Reopen
Owner/Admin reopen voids every entry with this `settlement_id`, except refund entries the user marks "keep" (money really paid). The settlement becomes VOID and the tenancy ENDED. A new draft can then be prepared.

## 11. Utility charges

### 11.1 Consumption
- Readings of one meter are ordered by `reading_date`. The **previous** reading for a new reading is the latest ACTIVE reading before it. For tenant billing it must also be inside the current tenancy: if the latest reading predates the tenancy's MOVE_IN reading, the MOVE_IN reading is used.
- Normal: `consumption = current − previous` (must be ≥ 0, BR-017).
- Meter replaced on date r: `consumption = (old_final − previous) + (current − new_start)`, with METER_END (old_final) and METER_START (new_start) readings on r.

### 11.2 Amount
```text
amount_minor = round_money(consumption × rate × 10^exponent) + fixed_charge_minor
```
Integer implementation: consumption in thousandths (`c_milli`), rate in ten-thousandths (`r_e4`): `raw = c_milli × r_e4` is in 10⁻⁷ major units. Then `minor = raw × 10^exponent / 10^7`, rounded half-up to the rounding increment.

| Case (FIN-TEST-012) | Calculation | Charge |
|---|---|---|
| 4,951.5 − 4,732.0 = 219.5 kWh × ₹9.50, fixed 0 | 2,085.25 → whole rupees | **₹2,085** |
| Replacement: previous 8,700; old final 8,850; new start 0; current 60; rate 9.50 | (150 + 60) × 9.50 = 1,995 | **₹1,995** |
| Consumption 0, fixed ₹50 | | ₹50 |
| Consumption 0, fixed 0 | | no charge proposed |

- Rate and fixed charge are **snapshotted** on the charge (`rate`, `fixed_amount_minor`, `quantity`).
- Due date = reading date + tenancy grace days.
- Warning (not a block) if consumption > 5 × the average of the last 3 consumptions of that meter.

## 12. Late fees

- **MVP:** manual only (a LATE_FEE charge).
- **V1 automatic rule** (`late_fee_rule = {type: FIXED | PERCENT, value, after_days}`), for RENT-category charges only:
```text
deadline = charge.due_date + after_days
on the first job run with today > deadline:
    remaining_at_deadline = FIFO remaining of this charge using only entries with entry_date ≤ deadline
    if remaining_at_deadline > 0:
        fee = FIXED ? value : round_money(remaining_at_deadline × value / 100)
        insert CHARGE(RENT, LATE_FEE) fee, entry_date = due_date = deadline + 1,
               related_entry_id = charge.id, generated_key = "late:" + charge.id
for 30 days after creation: if a backdated payment makes remaining_at_deadline = 0,
    void the fee with reason "Paid on time (recorded late)"
```
**Example (FIN-TEST-022):** rent due 5 Sep, rule FIXED ₹500 after 3 days, so the deadline is 8 Sep. Nothing is paid by 8 Sep, and on 9 Sep a late fee of ₹500 is created. On 10 Sep a cash payment dated 7 Sep syncs from an offline phone; the re-evaluation finds remaining at 8 Sep = 0 and voids the fee.
**[LEGAL CHECK]** Some jurisdictions cap or restrict late fees; the rule is off by default.

## 13. Payments

| Topic | Rule |
|---|---|
| Partial / multiple | Any positive amount, any number of payments (FIFO handles them). |
| Advance | Pool exceeding charges becomes advance credit, applied automatically to later charges. |
| Late | A late payment reduces the overdue amount; late fees are separate (§12). |
| Dates | `entry_date` ≤ today + 1 and ≥ tenancy start − 365 days (BR-021). |
| Method | Required. OPENING_BALANCE is used only by opening entries. INTERNAL_TRANSFER moves money between tenancies of the same workspace (e.g. deposit carried to a new unit). |
| Receipt numbers | `receipt_prefix` + 6-digit zero-padded `receipt_seq` (e.g. R-000123), assigned by the server in the payment's transaction. Gap-free and never reused. Not assigned for OPENING_BALANCE or INTERNAL_TRANSFER. |
| Possible duplicate | Flag when another ACTIVE payment of the same tenancy has the same amount and entry_date and was created ≤ 24 h earlier. |
| "Collected" (reports) | Σ PAYMENT(RENT) − Σ REFUND(RENT), both excluding INTERNAL_TRANSFER, by entry_date. Deposit collections are reported separately; opening balances are never "collected". |

## 14. Discounts, waivers, write-offs

CREDIT(RENT) with a required reason. They reduce the balance and take part in FIFO like payments, but they are **not money received**: they are excluded from "Collected" and listed separately in statements. WRITE_OFF is used for uncollectable debt, typically after settlement.

## 15. Corrections and cancellations

| Action | Rule |
|---|---|
| Void | status → VOID with reason; excluded from all formulas; FIFO recomputed; receipt shows VOID. |
| Correct | Void + new entry (new id; a payment gets a new receipt number). |
| Void of deposit payment | Rejected if deposit_held would become negative (DEPOSIT_INSUFFICIENT). |
| Void inside a finalized settlement | Rejected (ENTRY_IN_SETTLEMENT); reopen the settlement instead. |
| Void of a generated charge | Allowed; the generated key stays taken, so the period is not billed again automatically. |
| Cancel tenancy | Only without ACTIVE PAYMENT, REFUND or DEPOSIT_APPLIED entries; all ACTIVE charges and credits voided with reason "Tenancy cancelled". |
| CLOSED tenancy | No new entries and no voids until the settlement is reopened (BR-015). |

## 16. Refunds of advance

REFUND(RENT) ≤ advance credit (= −rent_balance when negative) at the moment the server applies it (REFUND_EXCEEDS_CREDIT otherwise). **Example (FL-28):** balance −5,000 → refund 5,000 → balance 0.

## 17. Currency and rounding

| Topic | Rule |
|---|---|
| Exponent | ISO 4217 minor digits: INR 2, USD 2, EUR 2, AED 2, JPY 0, KWD 3. Obtained from platform APIs (Java `Currency.getDefaultFractionDigits()`, JS `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`). |
| Rounding increment | Workspace `round_to_whole_units` = true → 10^exponent minor units (whole ₹/$). False → 1 minor unit. |
| Method | Half-up on positive values (all amounts are positive). |
| Arithmetic | Kotlin: `Long` + `BigDecimal` with `RoundingMode.HALF_UP`. TypeScript: `bigint` for multiplications. SQL: `numeric`. Never `Float`/`Double`/JS `number` for intermediate products. |
| Input | User text → decimal string → minor units; more decimals than the exponent → validation error. |
| Display | Platform formatter with the record's currency and the viewer's locale; PDFs use the workspace country locale. |
| Mixed currencies | Never summed; reports return one total per currency (FIN-TEST-024 covers JPY and KWD). |

## 18. Summary formulas

```text
Outstanding (rent balance) = Charges + Rent refunds − Payments − Credits − Deposit applied
Overdue                    = Σ remaining of charges with due_date < today      (FIFO)
Deposit held               = Deposit payments − Deposit refunds − Deposit applied
Settlement:
    Deposit applied = min(Deposit held, max(Outstanding after final lines, 0))
    Refund due      = Deposit held − Deposit applied + Advance credit
    Amount owed     = max(Outstanding after final lines − Deposit applied, 0)
```

## 19. Shared test vectors

File: `spec/financial-vectors.json`. It is run by the Kotlin unit tests (Android `domain/`), the TypeScript tests (`server/domain`), and an SQL test that loads each ledger case into a test database and compares `v_charge_allocation`.

```json
{
  "id": "FIN-TEST-003",
  "description": "One payment against two months of arrears (FIFO)",
  "function": "ledger",
  "currency": "INR", "round_to_whole_units": true, "today": "2026-09-10",
  "entries": [
    { "id": "a1", "kind": "CHARGE", "account": "RENT", "category": "RENT", "amount_minor": 1500000, "entry_date": "2026-07-01", "due_date": "2026-07-05" },
    { "id": "a2", "kind": "CHARGE", "account": "RENT", "category": "RENT", "amount_minor": 1500000, "entry_date": "2026-08-01", "due_date": "2026-08-05" },
    { "id": "a3", "kind": "CHARGE", "account": "RENT", "category": "RENT", "amount_minor": 1500000, "entry_date": "2026-09-01", "due_date": "2026-09-05" },
    { "id": "p1", "kind": "PAYMENT", "account": "RENT", "amount_minor": 2000000, "entry_date": "2026-09-10", "method": "CASH" }
  ],
  "expected": {
    "rent_balance_minor": 2500000, "advance_minor": 0, "overdue_minor": 2500000,
    "charges": {
      "a1": { "paid_minor": 1500000, "remaining_minor": 0, "state": "PAID", "overdue": false },
      "a2": { "paid_minor": 500000, "remaining_minor": 1000000, "state": "PARTLY_PAID", "overdue": true },
      "a3": { "paid_minor": 0, "remaining_minor": 1500000, "state": "UNPAID", "overdue": true }
    },
    "aging": { "not_due": 0, "d1_30": 1500000, "d31_60": 1000000, "d61_90": 0, "d90_plus": 0 }
  }
}
```

Other `function` values: `prorate`, `utility`, `schedule`, `revision_adjustments`, `settlement`, `late_fee`.

| Vector | Covers |
|---|---|
| FIN-TEST-001 | Full payment clears a charge |
| FIN-TEST-002 | Partial payments, overdue after due date (§3.4 A) |
| FIN-TEST-003 | Arrears FIFO (§3.4 B) |
| FIN-TEST-004 | Advance consumed by later charges; rent increase during advance (§3.4 C) |
| FIN-TEST-005 | Void payment restores status |
| FIN-TEST-006 | Void charge moves credit forward |
| FIN-TEST-007 | Same-due-date ordering (opening → rent → utility → other) |
| FIN-TEST-008 | First-period proration, calendar cycle |
| FIN-TEST-009 | February proration, leap and non-leap |
| FIN-TEST-010 | Move-out proration credit, calendar and anniversary |
| FIN-TEST-011 | Rounding to minor units (USD) |
| FIN-TEST-012 | Utility amounts incl. replacement and fixed charge |
| FIN-TEST-013 | Rent revision adjustments |
| FIN-TEST-014 | Generation with recurring charges and partial first period |
| FIN-TEST-015 | Deposit lifecycle figures |
| FIN-TEST-016 | Deposit apply/refund limits and DEPOSIT_EXCEEDS_DUE |
| FIN-TEST-017 | Opening balances |
| FIN-TEST-018 | Settlement with refund |
| FIN-TEST-019 | Settlement with amount owed |
| FIN-TEST-020 | Settlement with advance refund |
| FIN-TEST-021 | Aging buckets as of a past date |
| FIN-TEST-022 | V1 late fee incl. auto-void |
| FIN-TEST-023 | 12-period schedule with revision and recurring charges |
| FIN-TEST-024 | Zero- and three-decimal currencies |
