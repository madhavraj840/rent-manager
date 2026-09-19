# 18 — Edge Case Register

```text
Version:      0.1
Status:       Draft — awaiting owner review
Last Updated: 2026-09-18
Depends On:   01–17
Affected By:  new edge cases found in beta (add them here with a test)
```

**Severity**
- **Critical:** money or data lost, duplicated or exposed to the wrong person.
- **High:** wrong figures shown or a core workflow blocked.
- **Medium:** confusing but recoverable by the user.
- **Low:** cosmetic or rare, with a clear workaround.

"Prevented" means the design stops it from happening; the listed behaviour is what the user sees instead. References point to rules (BR), flows (FL), decisions (D), docs (§) and tests.

## A. Setup and structure

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-001 | Landlord has zero properties | Low | Home shows the onboarding checklist; reports show empty states; nothing errors | FL-01, SCR-06 |
| EC-002 | Property has zero units | Low | Property detail prompts "Add units"; excluded from occupancy (0/0 shown as "—") | F-PROP-4 |
| EC-003 | Independent house (single unit) | Low | Unit "Main" created automatically | PROP-TEST-001 |
| EC-004 | Bulk unit labels collide with existing ones | Medium | Whole bulk operation rejected; colliding labels listed | UNIT-TEST-001 |
| EC-005 | Co-owners' shares don't total 100% | Medium | Save blocked; "Split equally" helper | PROP-TEST-002 |
| EC-006 | One manager handles properties of different owners | Low | Owners recorded per property; each owner can be a Viewer scoped to their properties | D-016 |
| EC-007 | Mixed-use building (shops + flats) | Low | Unit type per unit; filter by type | D-013 |
| EC-008 | PG/hostel beds billed separately in shared rooms | Medium | Each bed is a unit (D-014); a shared room meter is billed with manual utility charges until V1 split | D-014, UTIL-006 |

## B. Tenants and tenancies

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-010 | Tenant has no phone number | Low | Allowed with a warning; WhatsApp/SMS reminders disabled; email/share sheet available | F-TEN-1 |
| EC-011 | Tenant has neither phone nor email | Low | Allowed; "Remind" disabled with explanation | F-PAY-6 |
| EC-012 | Two different tenants with the same name | Low | Allowed; pickers show phone and unit to distinguish | SCR-43 |
| EC-013 | Same person entered twice as two tenants | Medium | Duplicate warning at creation; merge in V1 | TENANT-005 |
| EC-014 | Multiple tenants (family/roommates) in one unit | Low | One tenancy, one primary, co-tenants; receipts to primary | TENANCY-004 |
| EC-015 | One co-tenant leaves, others stay | Medium | Set "left on" for that party; if they were primary, choose a new primary first | F-TNCY-3 |
| EC-016 | One tenant rents two units | Medium | Two tenancies with separate ledgers; a single transfer covering both is recorded as two payments | TNCY-TEST-003 |
| EC-017 | Tenant leaves early (before lease end) | Medium | Notice/move-out on any date; proration credit proposed; landlord may keep the full month or add a lease-break charge | FL-18, D-040 |
| EC-018 | Former tenant returns later | Low | New tenancy for the same tenant; history shows both; old balance stays on the old tenancy | TENANCY-005 |
| EC-019 | Tenant moves to another unit | Medium | MVP manual procedure with INTERNAL_TRANSFER entries; guided in V1 | FL-22 |
| EC-020 | Move-in date in the future | Low | Unit shows Upcoming; deposit charge now; rent from move-in date | FL-05 |
| EC-021 | Move-in backdated by months | Medium | Wizard proposes every past period; user edits or removes lines | F-MIN-3 |
| EC-022 | Tenancy created on the wrong unit/tenant | Medium | Cancel (if no payments), or void payments then cancel | TNCY-TEST-005 |
| EC-023 | Lease end passes without renewal | Low | Tenancy continues month-to-month; "Lease expired" label; in digest | TENANCY-007 |
| EC-024 | Notice withdrawn | Medium | Planned date cleared; the job generates any periods it skipped (catch-up via generated keys) | RENT-TEST-002 |
| EC-025 | Tenant stays past planned move-out while a new tenant is booked | High | Extending the date is blocked (UNIT_OCCUPIED) until the new tenancy's start moves | TNCY-TEST-002 |
| EC-026 | Tenant absconds or dies | Medium | Move-out with best-known date, notes and photos; settlement applies deposit; remainder written off or pursued | FL-18, FL-19 |
| EC-027 | Company tenant | Low | Kind = company; contact person as co-tenant | TENANT-001 |
| EC-028 | Same-day turnover | Low | Old move-out = last occupied day; new move-in next day; one physical reading saved as MOVE_OUT and MOVE_IN | FL-21 |

## C. Rent and charges

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-030 | Rent changes during the tenancy | Medium | Revision from a period start; adjustments proposed for already-charged periods | TNCY-TEST-006 |
| EC-031 | Rent change wanted in the middle of a period | Low | Not supported; use next period start, or a manual charge/credit for the part | D-022 |
| EC-032 | Rent-free month | Low | Waiver credit, or void the generated charge (never re-created) | RENT-TEST-003 |
| EC-033 | Rent job did not run for days | High | Next run creates all missing periods exactly once | RENT-TEST-002 |
| EC-034 | Landlord wants rent period to start on the 30th/31st | Low | Not allowed; suggest day 28 or day 1 with a short first period | D-022 |
| EC-035 | Charges exist for periods after the tenant left | Medium | Settlement proposes voiding them | FL-19 |
| EC-036 | Electricity bill unavailable at move-out | Medium | Skip the line; add a manual utility charge later (ENDED tenancies accept charges) or estimate | FL-19 |
| EC-037 | Quarterly or yearly rent (commercial) | Medium | Not supported in MVP; manual charges | D-051 |
| EC-038 | Tax on rent (GST/VAT) | Low | Manual TAX charge; no tax reports **[LEGAL CHECK]** | 10 §2.1 |

## D. Payments

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-040 | Rent paid late | Low | Overdue until paid; manual late fee (automatic in V1) | FL-12 |
| EC-041 | Rent paid partially | Low | Partly paid with remaining amount; overdue after due date | FIN-TEST-002 |
| EC-042 | Rent paid months in advance | Low | Advance credit applied automatically to future charges | FIN-TEST-004 |
| EC-043 | Two months paid together | Low | FIFO settles both | FIN-TEST-003 |
| EC-044 | Tenant pays before the month's charge exists | Low | Shows as advance until the charge is generated | D-023 |
| EC-045 | Tenant does not pay at all | Medium | Overdue, digest, reminders; eventually settlement and write-off | FL-12 |
| EC-046 | Tenant pays after a late fee was added | Low | Payment settles the older rent first, then the fee (due-date order) | 10 §3 |
| EC-047 | Same payment tapped twice on one device | Critical — prevented | Button disabled while saving; one op | 09 §3.4 |
| EC-048 | Same payment entered on phone and website | High | Both kept; later one flagged "Possible duplicate"; a person voids one | SYNC-TEST-003 |
| EC-049 | Payment amount entered wrongly | Medium | Void + re-enter; new receipt number; old receipt shows VOID | FL-17 |
| EC-050 | Cheque bounces | Medium | Void with "Cheque bounced"; optional bounce-fee charge | F-PAY-2 |
| EC-051 | Payment recorded on the wrong tenancy | Medium | Void and re-enter on the right one | FL-17 |
| EC-052 | Payment dated in the future (wrong device clock) | Medium | Server rejects dates > today + 1; sync issue offers edit | BR-021 |
| EC-053 | Booking/token money before move-in | Low | Payment dated up to 365 days before start; becomes advance | BR-021 |
| EC-054 | One bank transfer for several tenancies | Medium | Record one payment per tenancy (split helper in V1) | FL-09 |
| EC-055 | Refund requested but advance already consumed | Medium | REFUND_EXCEEDS_CREDIT with the available amount | PAY-TEST-006 |
| EC-056 | Receipt needed while offline | Medium | "Available after sync"; landlord can share the proof photo meanwhile | D-027 |

## E. Deposits and move-out

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-060 | Deposit paid in instalments | Low | Several deposit payments; "Deposit due" shown until complete | FIN-TEST-015 |
| EC-061 | Deposit recorded twice | Critical — prevented | Second payment rejected: DEPOSIT_EXCEEDS_DUE | PAY-TEST-005 |
| EC-062 | Deposit partially refunded | Medium | Refund ≤ held; tenancy stays ENDED until held reaches 0 | 10 §8 |
| EC-063 | Deductions exceed the deposit | Medium | "Tenant owes ₹x"; ENDED; closes after payment or write-off | SETTLE-TEST-002 |
| EC-064 | Tenant asks to use the deposit for the last month's rent | Low | Deposit application any time (≤ held and ≤ balance) | F-DEP-3 |
| EC-065 | Settlement disputed after finalizing | Medium | Owner/Admin reopen; refunds actually paid can be kept | SETTLE-TEST-004 |
| EC-066 | Offline payment arrives after the website finalized settlement | High | ENDED → accepted (may auto-close); CLOSED → rejected with options | SYNC-TEST-016 |
| EC-067 | Move-out recorded by mistake | Medium | Undo while settlement is a draft | TNCY-TEST-008 |
| EC-068 | Deposit increased along with rent | Low | Deposit top-up charge; collect the difference | F-DEP-2 |
| EC-069 | Legal deposit interest or refund deadlines | Low | Not calculated; landlord's responsibility **[LEGAL CHECK]** | D-045 |

## F. Utilities

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-070 | New reading lower than previous | Medium | Blocked unless marked meter replacement | UTIL-TEST-001 |
| EC-071 | Meter replaced | Low | METER_END + METER_START on the same date; consumption spans both | 10 §11 |
| EC-072 | Meter rolls over (99999 → 00012) | Low | Recorded as replacement (end 99999, start 0) | 10 §11 |
| EC-073 | No opening reading at move-in | Medium | Next regular reading becomes the baseline (no charge for it); tenancy flagged | F-MIN-2 |
| EC-074 | Unusually high consumption (likely typo) | Medium | Confirmation warning before saving | FL-14 |
| EC-075 | Latest reading belongs to the previous tenant | High | Billing starts from this tenancy's MOVE_IN reading | UTIL-TEST-005 |
| EC-076 | Same meter read twice on the same day | Low | READING_DUPLICATE | UTIL-TEST-002 |
| EC-077 | One meter shared by several units | Medium | MVP: manual utility charges per tenancy; V1 split | UTIL-006 |
| EC-078 | Electricity rate changes | Low | Future bills only; each charge keeps its rate | 10 §11 |

## G. Dates, time zones, currency

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-080 | Property in a different time zone than the workspace | Low | "Today" may differ by one day near midnight; documented limitation | D-044 |
| EC-081 | Proration in a leap-year February | Low | Actual days (29) used | FIN-TEST-009 |
| EC-082 | Device clock wrong | Medium | Server validates dates; ordering uses server versions | 08 §5 |
| EC-083 | Workspace time zone changed | Low | Future "today" uses the new zone; stored dates unchanged | F-SET-1 |
| EC-084 | Properties in several currencies | Medium | Totals per currency; currency switch on dashboard; no conversion | D-012 |
| EC-085 | Currency with 0 or 3 decimals (JPY, KWD) | Low | Exponent from ISO data; rounding per 10 §17 | FIN-TEST-024 |
| EC-086 | Currency change wanted after tenancies exist | Low | Blocked (CURRENCY_LOCKED) | PROP-TEST-001 |

## H. Sync and offline

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-090 | Changes made offline for days | Medium | Queued; reminder after 24 h; synced on reconnect | OFF-TEST-002 |
| EC-091 | Same field edited on phone and website | Medium | Later arrival wins; audit keeps both | SYNC-TEST-004 |
| EC-092 | Sync rejected by a rule | High | Sync issue with edit/discard; dependent changes blocked | SYNC-TEST-006 |
| EC-093 | Same request sent twice (retry) | Critical — prevented | op_id idempotency; stored result returned | SYNC-TEST-002 |
| EC-094 | Record deleted on the server during the offline period | Medium | Edit dropped (CONFLICT_DELETED), local row removed, notice shown | SYNC-TEST-005 |
| EC-095 | App killed mid-sync | High | Resumes; no duplicates, no gaps | SYNC-TEST-018 |
| EC-096 | Phone offline for more than 90 days | Medium | RESYNC_REQUIRED → full sync; queued creates still idempotent by id | SYNC-TEST-014 |
| EC-097 | Phone lost or broken with unsynced changes | High | Those changes are lost (they existed only on the phone). Mitigation: sync on every connectivity, 24-h reminder, visible pending count | 08 §13 |
| EC-098 | App updated while changes are pending | High | Ops preserved; server supports old op schemas ≥ 6 months | SYNC-TEST-013 |
| EC-099 | Very large queue (1,000+ changes) | Medium | Sent in batches of 100 with progress | 08 §7 |
| EC-100 | Offline tenancy start overlaps one started on the website | High | Rejected with the conflicting tenancy shown; dependent payments blocked until fixed | SYNC-TEST-006 |

## I. Authentication, access, accounts

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-110 | Authentication expired while offline | High | Silent refresh; if it fails, "Sign in to sync"; changes kept | SYNC-TEST-012 |
| EC-111 | Another user signs in on a phone holding the previous user's unsynced changes | Critical — prevented | Changes never sent under the new user; previous user can sign in to send them | SYNC-TEST-012 |
| EC-112 | Member removed while offline with pending changes | High | Changes rejected (FORBIDDEN); local data wiped after offering a text summary | SYNC-TEST-011 |
| EC-113 | Member's property scope reduced | Medium | Full resync; out-of-scope changes rejected | SYNC-TEST-010 |
| EC-114 | Workspace Owner wants to leave | Medium | Must transfer ownership to an Admin first | TEAM-TEST-003 |
| EC-115 | Invite opened with a different email | Medium | INVITE_EMAIL_MISMATCH with the expected address | SEC-TEST-008 |
| EC-116 | User deletes account with unsynced changes | High | Blocked until synced or explicitly discarded | F-ACC-4 |
| EC-117 | Workspace deleted while members are offline | High | Next sync gets 404 → local data wiped | 08 §15 |

## J. Deletion and archiving

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-120 | Property deleted | High — prevented | Only allowed without dependent records; otherwise archive | PROP-TEST-003 |
| EC-121 | Tenant deleted | High — prevented | Only allowed without tenancies; otherwise archive | TENANT-TEST-001 |
| EC-122 | Unit archived while a tenancy is upcoming | Medium | Blocked (TENANCY_ACTIVE) | F-UNIT-3 |
| EC-123 | Property archived with settlements still pending | Low | Allowed; settlement remains possible from the archived property | FL-23 |
| EC-124 | Property sold with sitting tenants | Medium | End tenancies with notes; export statements; new owner starts their own workspace (transfer is Future) | FL-23 |

## K. Documents and storage

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-130 | Photo taken offline; its parent record deleted before upload | Low | Upload cancelled; local file deleted | 08 §12 |
| EC-131 | Storage quota reached | Medium | Uploads rejected with message; data entry unaffected | DOC-TEST-002 |
| EC-132 | Upload keeps failing on a bad network | Medium | Automatic retries; sync issue after 10 failures | 08 §12 |
| EC-133 | Manager shares an ID document outside the app | Medium | Allowed for permitted roles; view audited; after download it cannot be controlled (stated in guidance) | 11 §8 |
| EC-134 | Document used as evidence in a finalized settlement | Low | Cannot be deleted | DOC-TEST-004 |

## L. Scale and performance

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-140 | Workspace larger than 2,000 units | Medium | Website fine; Android initial sync slower; partial sync later | D-047 |
| EC-141 | Tenancy with 10+ years of entries | Low | FIFO per tenancy remains fast; statement PDF paginated | 13 §7 |
| EC-142 | First-of-month peak with many payments | Medium | Per-workspace write serialization adds small latency; monitored | 08 §5.2 |

## M. Reports

| ID | Situation | Severity | Expected behaviour | Ref |
|---|---|---|---|---|
| EC-150 | Report period with no data | Low | Empty state message | SCR-81 |
| EC-151 | Viewing a past month on the dashboard | Low | Balance metrics shown as of that month's end | 13 §2 |
| EC-152 | Mixed currencies in one report | Medium | One total row per currency | 13 §1 |
