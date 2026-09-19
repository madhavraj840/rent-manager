# 01 — Product Requirements Document (PRD)

```text
Version:      0.1
Status:       Draft — awaiting owner review
Last Updated: 2026-09-18
Depends On:   00_PRODUCT_DISCOVERY.md
Affected By:  16_DECISION_LOG.md, 10_FINANCIAL_RULES.md (business rules detail)
```

## 1. Product overview

"Rent Manager" (working title) is a record-keeping system for rental properties. It has three parts that share one backend:

| Part | Users | Purpose |
|---|---|---|
| Android app | Landlords, managers, co-owners (V1: tenants, staff) | Fast data entry during collection rounds, works offline |
| Website | Same users | Full management on desktop or phone browser, reports, exports, team admin |
| Backend (API + PostgreSQL) | — | Single source of truth, business rules, sync, jobs, files |

The product **records** rent and related money (it never collects or moves money), calculates what each tenant owes, and keeps proof: photos, receipts and statements.

## 2. Problem statement

Landlords and small property managers with many units keep records in notebooks, Excel files, phone notes and WhatsApp chats. As a result:

1. **They lose track of who owes what.** Partial payments, advances, electricity charges and arrears are calculated by hand every month, which leads to mistakes.
2. **They lack proof in disputes.** "I paid you in March" cannot be verified; receipts are not issued or not kept.
3. **Move-out settlements are contentious.** Opening meter readings, the condition at move-in and the deposit amount are not recorded reliably.
4. **Records are scattered and not shared.** Co-owners, family members and managers each hold part of the information; nobody sees the full picture.
5. **Paper is lost.** Agreements, ID copies and bills are kept in files that get lost or damaged.

## 3. Target users

| Segment | Description | Size of portfolio (assumed) | Priority |
|---|---|---|---|
| Individual landlord | Owns several properties/units, manages them personally or with family | 3–100 units | Primary (MVP) |
| Property manager / small agency | Manages units for several owners, has 1–10 staff | 20–2,000 units | Primary (MVP) |
| Co-owner / partner / accountant | Needs visibility, sometimes edit rights | — | Secondary (MVP) |
| Tenant | Wants to see dues, receipts, notices; talk to the landlord | 1–2 tenancies | V1 (free) |

## 4. User personas

**P1 — Ramesh, individual landlord (India).** 52 years old. Owns two buildings (14 rooms + 4 shops) and one rented flat. He collects rent in cash and UPI in the first week of each month and reads electricity sub-meters himself. He currently uses a notebook and WhatsApp. He needs to see "who hasn't paid" in seconds, bill electricity per room, and give receipts. He is comfortable with WhatsApp but not with complicated apps. Signal is poor in one building's basement.

**P2 — Priya, property manager (India/UAE).** Runs a 4-person agency managing 140 units for 11 owners. She needs staff to record collections in the field, owners to see only their own properties, month-end reports per owner, and deposits tracked carefully because disputes are frequent. She works on the website at the office and the app in the field.

**P3 — Anil, passive co-owner.** Owns 50% of a building with his brother. He wants to check collections and income without editing anything.

**P4 — Sarah, small landlord (UK/US).** Owns 6 flats. Uses bank transfers. Needs a clean statement per tenant, lease end dates and a year-end income summary for her accountant. Uses an iPhone, so she will use the website (D-007).

**P5 — Tenant (V1).** Wants to know the amount due, pay by UPI using the landlord's QR, send proof, and get receipts without asking.

## 5. Goals

| ID | Goal | Measure (proposed target) |
|---|---|---|
| G1 | Know the collection status instantly | Home screen shows this month's paid / partial / unpaid / overdue for all units in < 2 s |
| G2 | Make data entry faster than a notebook | Recording a full payment from the Home screen takes ≤ 3 taps with defaults |
| G3 | Calculate correctly, always | 100% of financial test vectors pass on server and Android; zero known balance bugs at launch |
| G4 | Work without internet | Every MVP data-entry action works offline and syncs later without duplicates |
| G5 | Settle move-outs without dispute | Settlement statement lists readings, deductions, deposit and refund with evidence photos |
| G6 | Share safely | Co-owners and managers get scoped access; sensitive documents are protected and audited |

## 6. Non-goals

- Collecting or transferring money (no payment gateway, no wallets, no payouts). (D-004)
- Property listings, tenant search, marketplace features.
- Full accounting (double-entry bookkeeping, tax filing, GST/VAT invoices). Tax is only a manual charge category.
- Legal-compliance automation (deposit caps, statutory notices). The app records, it does not advise. (D-045)
- Native iOS app in MVP/V1. (D-007)
- Voice recordings. (D-011)

## 7. Core use cases

| ID | Use case | Actor | Release |
|---|---|---|---|
| UC-01 | Set up my portfolio (properties, units, owners) | Owner/Admin | MVP |
| UC-02 | Move a new tenant in (terms, deposit, readings, inspection, first charges) | Manager+ | MVP |
| UC-03 | Digitize an existing tenancy with opening balances | Manager+ | MVP |
| UC-04 | See this month's collection status and record payments | Manager+ | MVP |
| UC-05 | Chase overdue rent with a polite reminder and payment details | Manager+ | MVP |
| UC-06 | Bill electricity/water from meter readings | Manager+ | MVP |
| UC-07 | Record property expenses | Manager+ | MVP |
| UC-08 | Handle notice, move-out and deposit settlement | Manager+ | MVP |
| UC-09 | Review income, dues and deposits per property | All roles | MVP |
| UC-10 | Give a co-owner or employee scoped access | Owner/Admin | MVP |
| UC-11 | Work offline in the field and sync later | Android users | MVP |
| UC-12 | Prove a payment (receipt, statement) | Manager+ | MVP |
| UC-13 | Export all records for an accountant | Owner/Admin | MVP |
| UC-14 | Change rent from a date | Manager+ | MVP |
| UC-15 | Tenant checks dues, receipts and landlord's payment details | Tenant | V1 |
| UC-16 | Broadcast a notice to tenants | Manager+ | V1 |
| UC-17 | Chat with tenant, send payment QR, receive proof | Manager+, Tenant | V1 |
| UC-18 | Pay subscription per property | Owner | V1 |

## 8. Release definitions

### 8.1 MVP (free beta)

Landlord-side product for Owner, Admin, Manager and Viewer on **Android and web**:

- Accounts (Google, email code), workspaces, team invites with roles and property scoping
- Properties, units (bulk add), owners with shares
- Tenants, tenancies (new move-in, existing with opening balances), co-tenants
- Automatic monthly rent and recurring charges, proration, manual charges, credits
- Payments (FIFO), advances, voids, refunds, receipts (PDF), possible-duplicate warning
- Security deposit collection, holding, application and refund
- Move-in inspection, meters and readings, readings round, utility charges
- Notice, move-out, settlement (PDF), reopen settlement
- Expenses; documents with offline capture; sensitive-document protection
- Dashboard, rent roll, aging, collections, statements, deposit register, expenses, property income, vacancy and lease expiry; CSV export of everything
- Daily push digest, in-app notifications, transactional email; WhatsApp/SMS share links for reminders, receipts and payment details
- Offline-first Android with sync status and sync-issue resolution; audit log; account deletion

### 8.2 Version 1

- Tenant portal (Android app role + website): dues, ledger, receipts, shared documents, payment details, payment claims with proof
- Notice board; landlord–tenant chat (text, a few compressed images, payment QR card; no documents, D-057)
- Phone-number sign-in; Staff role
- Per-property billing on the website (D-009, D-010, D-054)
- Automatic late fees; owner statements; shared-meter split; recurring expenses; CSV import; guided unit transfer; move-in summary PDF; utility report; weekly summary email; push-triggered sync; tenant anonymization; inspection templates; property groups/tags

### 8.3 Future

iOS app (KMP), online rent collection, bank/UPI statement import and reconciliation, automated WhatsApp/SMS, voice notes, meter-reading OCR, tariff slabs, accounting/tax exports, more languages, e-signatures and agreement generation, maintenance tickets and vendors, owner portal with payouts, custom roles, public API, workspace-to-workspace transfer, non-monthly rent frequencies, deposit interest/jurisdiction rules.

## 9. Functional requirements

Priority: **MVP**, **V1**, **FUT** (Future). Details of each module are in `02_FEATURE_SPECIFICATION.md`; calculations are in `10_FINANCIAL_RULES.md`.

### 9.1 Account (ACC)

| ID | Requirement | Priority |
|---|---|---|
| ACC-001 | Users can sign up and sign in with a Google account. | MVP |
| ACC-002 | Users can sign up and sign in with a one-time code sent to their email (no passwords). | MVP |
| ACC-003 | Sessions persist across app restarts; tokens refresh silently; users can sign out, and sign out of all devices. | MVP |
| ACC-004 | Users maintain a profile: name, email (verified), phone (E.164, optional), locale. | MVP |
| ACC-005 | Users can delete their account from the app and the website (see FL-25 for workspace handling). | MVP |
| ACC-006 | Users can sign in with a one-time code sent by SMS to their phone number. | V1 |
| ACC-007 | Android users can enable a biometric/device-credential app lock. | MVP |
| ACC-008 | Users accept the current terms of service and privacy policy at sign-up; the accepted version and time are recorded, and a material change requires re-acceptance at next sign-in. | MVP |

### 9.2 Workspace and team (TEAM)

| ID | Requirement | Priority |
|---|---|---|
| TEAM-001 | On first sign-in a user creates a workspace: name, country, default currency, time zone. | MVP |
| TEAM-002 | A user can belong to several workspaces and switch between them. | MVP |
| TEAM-003 | Owner/Admin invite members by email with role Admin, Manager or Viewer; invites expire after 7 days and are bound to the email address. | MVP |
| TEAM-004 | Manager and Viewer memberships can be limited to selected properties. | MVP |
| TEAM-005 | Owner/Admin can change a member's role or property access, or revoke access; changes apply on the member's next request or sync. | MVP |
| TEAM-006 | Owner/Admin can view the audit log (website). | MVP |
| TEAM-007 | The Owner can transfer ownership to an Admin. | MVP |
| TEAM-008 | Staff role: may record payments, readings and expenses, and void only their own entries within 24 hours. | V1 |

### 9.3 Owners (OWN)

| ID | Requirement | Priority |
|---|---|---|
| OWN-001 | Each property can list its owners with ownership share (%); shares must total 100% when more than one owner is listed. | MVP |
| OWN-002 | Owner statement: income, expenses and net for each owner's share over a period. | V1 |

### 9.4 Properties (PROP)

| ID | Requirement | Priority |
|---|---|---|
| PROP-001 | Create a property: name, type, address, country, currency, notes, photo. | MVP |
| PROP-002 | Edit a property; its currency is locked once any tenancy exists on it. | MVP |
| PROP-003 | Archive/unarchive a property (allowed only with no ACTIVE tenancy); archived properties are excluded from default lists and dashboards. | MVP |
| PROP-004 | Delete a property only when it has no tenancies, ledger entries, meters, readings, expenses or documents; otherwise offer archive. | MVP |
| PROP-005 | Property list with units count, occupancy and outstanding amount; filter by type and archived state; sort by name, outstanding, occupancy. | MVP |
| PROP-006 | Group properties with tags or areas. | V1 |

### 9.5 Units (UNIT)

| ID | Requirement | Priority |
|---|---|---|
| UNIT-001 | Add units one by one or in bulk (count + naming pattern, e.g. "Room {n}" from 101). | MVP |
| UNIT-002 | Unit attributes: label (unique in property), type, floor/block label, area, default rent, default deposit, notes. | MVP |
| UNIT-003 | Unit status is derived: Vacant, Occupied, Upcoming (future tenancy), On notice, Archived. | MVP |
| UNIT-004 | Archive a unit with no ACTIVE tenancy; delete a unit only when it never had a tenancy, meter or document. | MVP |
| UNIT-005 | Unit detail shows current and past tenancies. | MVP |

### 9.6 Tenants (TENANT)

| ID | Requirement | Priority |
|---|---|---|
| TENANT-001 | Create a tenant: individual or company; full name; phone(s); email; permanent address; emergency contact; ID type and last 4 characters only; notes; photo. | MVP |
| TENANT-002 | Edit a tenant; a tenant exists independently of units and can have many tenancies. | MVP |
| TENANT-003 | Tenant list with Current / Former / All filter and search by name, phone, email, unit. | MVP |
| TENANT-004 | Tenant detail with call, WhatsApp, SMS and email actions, all tenancies with balances, and documents. | MVP |
| TENANT-005 | Warn when a new tenant's phone or email matches an existing tenant in the workspace. | MVP |
| TENANT-006 | Archive a tenant with no ACTIVE tenancy; delete only a tenant who never had a tenancy. | MVP |
| TENANT-007 | Anonymize a former tenant's personal data while keeping amounts. | V1 |

### 9.7 Tenancies (TENANCY)

| ID | Requirement | Priority |
|---|---|---|
| TENANCY-001 | Start a new tenancy: unit, primary tenant, co-tenants/occupants, move-in date, lease end date (optional), rent, cycle day, grace days, deposit, notice period, recurring charges, notes, agreement document. | MVP |
| TENANCY-002 | Add an existing tenancy (already running before the app) with original start date, billing start date, opening arrears or advance, deposit already held, and baseline meter readings; no history is generated before the billing start date. | MVP |
| TENANCY-003 | A unit cannot have two tenancies whose occupancy dates overlap (cancelled tenancies excluded). | MVP |
| TENANCY-004 | A tenancy has exactly one primary tenant and any number of co-tenants/occupants; parties can be added or removed. | MVP |
| TENANCY-005 | A tenant can hold several tenancies at the same time. | MVP |
| TENANCY-006 | Change rent from an effective period start date; history is kept; if affected periods were already charged, the app proposes adjustment entries for confirmation. | MVP |
| TENANCY-007 | Set, extend or clear the lease end date (renewal); expired leases continue month-to-month and are flagged. | MVP |
| TENANCY-008 | Cancel a tenancy created by mistake when it has no active payments, refunds or deposit applications; its charges are voided automatically. | MVP |
| TENANCY-009 | Tenancy detail shows summary (rent, due date, balance, deposit), ledger, details, utilities, documents, inspections and activity. | MVP |
| TENANCY-010 | Guided "move to another unit" that ends one tenancy and starts another with linked deposit and balance transfer. | V1 |

### 9.8 Rent and charges (RENT)

| ID | Requirement | Priority |
|---|---|---|
| RENT-001 | The server creates one rent charge per rent period for every ACTIVE tenancy on the period start date (workspace time zone), from billing start until move-out; never twice for a period, never re-created after a user voids it. | MVP |
| RENT-002 | Partial first and last periods are prorated by days; the app proposes the amount and the user can change it before confirming move-in or settlement. | MVP |
| RENT-003 | Users can add manual charges: utility, maintenance, parking, repair/damage, cleaning, late fee, tax, other, with description, amount, date and due date. | MVP |
| RENT-004 | Charge amount and dates cannot be edited; corrections are made by voiding (with reason) and adding a new charge. | MVP |
| RENT-005 | Each charge shows a derived status (Unpaid, Partly paid, Paid) and an Overdue flag, computed by applying payments and credits oldest-due-first. | MVP |
| RENT-006 | Users can add credits: discount, waiver, adjustment, write-off; each needs a reason. | MVP |
| RENT-007 | Tenancy shows a rent schedule preview for the next 12 periods (dates and amounts). | MVP |
| RENT-008 | Automatic late fee per tenancy rule (fixed or %, after N days past due, once per charge). | V1 |
| RENT-009 | Recurring fixed monthly charges per tenancy (e.g. maintenance, parking) are generated with rent each period, with effective dates. | MVP |

### 9.9 Payments (PAY)

| ID | Requirement | Priority |
|---|---|---|
| PAY-001 | Record a payment: tenancy, amount, date received, method (cash, bank transfer, UPI, cheque, card, mobile wallet, other), reference, note, proof photos, and whether it is towards rent & charges or the security deposit. | MVP |
| PAY-002 | Payments on the rent account apply oldest-due-first; any excess becomes an advance credit that is used automatically by later charges. | MVP |
| PAY-003 | Any number of partial payments per period is supported. | MVP |
| PAY-004 | Void a payment with a reason (e.g. cheque bounced, entered in error); voided payments remain visible and are excluded from all totals. | MVP |
| PAY-005 | Every accepted payment gets a sequential receipt number per workspace; a PDF receipt can be viewed and shared; voided payments' receipts show VOID. | MVP |
| PAY-006 | Warn about a possible duplicate when another active payment on the same tenancy has the same amount and date and was recorded within 24 hours. | MVP |
| PAY-007 | Record a refund of advance credit to the tenant (amount ≤ credit). | MVP |
| PAY-008 | Store payment instructions (UPI ID, bank details, payment link, QR image) at workspace level with optional per-property override. | MVP |
| PAY-009 | Send a reminder: prefilled message with amount due, due date and payment instructions, opened in WhatsApp, SMS or the share sheet. | MVP |
| PAY-010 | Tenants submit a payment claim with proof; the landlord accepts (creates a payment) or rejects it with a reason. | V1 |
| PAY-011 | Collect rent online through a payment provider. | FUT |

### 9.10 Security deposit (DEP)

| ID | Requirement | Priority |
|---|---|---|
| DEP-001 | The agreed deposit creates a deposit charge on the tenancy's deposit account; it can be collected in several payments. | MVP |
| DEP-002 | Show deposit agreed, received, held, applied and refunded per tenancy, and a workspace deposit register. | MVP |
| DEP-003 | Increase the deposit (new deposit charge) or reduce it (deposit credit or refund) during a tenancy. | MVP |
| DEP-004 | At settlement the deposit held is applied to what the tenant owes; the remainder is refunded or stays as refund due. | MVP |
| DEP-005 | Deposit held can never become negative; refunds and applications above it are rejected. | MVP |
| DEP-006 | Country-specific deposit rules (caps, interest, deadlines). | FUT |

### 9.11 Move-in (MOVEIN)

| ID | Requirement | Priority |
|---|---|---|
| MOVEIN-001 | Record a move-in inspection: areas and items with condition (good, fair, damaged, missing, n/a), notes, photos, keys handed over. | MVP |
| MOVEIN-002 | Record opening readings (with photo) for every meter on the unit; skipping needs a reason. | MVP |
| MOVEIN-003 | Before confirming, show the proposed first charges: prorated first rent, recurring charges, deposit, other move-in charges; the user may edit amounts. | MVP |
| MOVEIN-004 | Move-in summary PDF (terms, deposit, readings, inspection). | V1 |

### 9.12 Move-out (MOVEOUT)

| ID | Requirement | Priority |
|---|---|---|
| MOVEOUT-001 | Record notice date and planned move-out date; the unit shows "On notice"; the digest reminds before the date. | MVP |
| MOVEOUT-002 | Record move-out: actual date, final meter readings with photos, move-out inspection side by side with move-in, keys returned. | MVP |
| MOVEOUT-003 | Settlement: preview final rent proration, final utilities, deductions, balance, deposit held, deposit applied, refund due or amount owed; finalizing creates all ledger entries atomically and produces a settlement PDF. | MVP |
| MOVEOUT-004 | After settlement with zero balances the tenancy is CLOSED and read-only; the unit becomes vacant from the day after move-out. | MVP |
| MOVEOUT-005 | Owner/Admin can reopen a finalized settlement; its entries are voided and the tenancy returns to ENDED. | MVP |

### 9.13 Utilities (UTIL)

| ID | Requirement | Priority |
|---|---|---|
| UTIL-001 | Define meters on a unit or on a property (common): type, label, serial number, unit of measure, rate per unit, fixed charge. | MVP |
| UTIL-002 | Record a reading (date, value, photo); readings may not decrease unless recorded as a meter replacement. | MVP |
| UTIL-003 | Create a utility charge from two readings: consumption × rate + fixed charge, with the rate stored on the charge; preview before confirming. | MVP |
| UTIL-004 | Readings round: enter readings for all meters of a property on one screen and create all utility charges in one step. | MVP |
| UTIL-005 | Record a utility bill amount without a meter as a charge with an optional bill photo. | MVP |
| UTIL-006 | Split a shared meter's consumption among several tenancies (equal or by ratio). | V1 |
| UTIL-007 | Tariff slabs and time-of-day rates. | FUT |

### 9.14 Expenses (EXP)

| ID | Requirement | Priority |
|---|---|---|
| EXP-001 | Record an expense: property (optional unit, or workspace-level), category, amount, date, payee, method, reference, note, receipt photo. | MVP |
| EXP-002 | Edit or void an expense; all changes are audited. | MVP |
| EXP-003 | Recurring expenses (e.g. monthly salary). | V1 |

### 9.15 Maintenance (MAINT)

| ID | Requirement | Priority |
|---|---|---|
| MAINT-001 | Maintenance requests with status, assignee, cost linked to expenses. | FUT |

### 9.16 Documents (DOC)

| ID | Requirement | Priority |
|---|---|---|
| DOC-001 | Attach JPG, PNG, WebP or PDF files (≤ 10 MB) to properties, units, tenants, tenancies, ledger entries, expenses, readings, inspections and inspection items. | MVP |
| DOC-002 | Documents have a category (agreement, ID proof, address proof, police verification, payment proof, bill, photo, payment QR, other); ID, address and police documents are sensitive. | MVP |
| DOC-003 | Files captured offline are stored on the device and uploaded automatically when online. | MVP |
| DOC-004 | Sensitive documents are visible only to Owner, Admin and Manager with access to the property; each view is audited. | MVP |
| DOC-005 | Deleted documents are recoverable for 30 days, then purged. | MVP |
| DOC-006 | Each workspace has a storage quota (D-053); uploads beyond it are rejected with a clear message. | MVP |

### 9.17 Notifications (NOTIF)

| ID | Requirement | Priority |
|---|---|---|
| NOTIF-001 | Daily push digest per member at the configured time: rents due today, newly overdue, move-outs within 7 days, leases ending within 30 days; not sent when empty. | MVP |
| NOTIF-002 | In-app notification centre on Android and web with read/unread state. | MVP |
| NOTIF-003 | Transactional emails: sign-in codes, invites, access changes, deletion notices, storage quota warnings. | MVP |
| NOTIF-004 | Per-user notification preferences per workspace (event toggles, digest time). | MVP |
| NOTIF-005 | Android shows a local notification when changes have been waiting to sync for more than 24 hours or a sync issue needs attention. | MVP |
| NOTIF-006 | Tenant notifications: rent due, receipt, overdue reminder, notices, chat messages. | V1 |
| NOTIF-007 | Automated WhatsApp/SMS messages through providers. | FUT |
| NOTIF-008 | Weekly summary email to Owner/Admin. | V1 |

### 9.18 Reports (REP)

| ID | Requirement | Priority |
|---|---|---|
| REP-001 | Dashboard for a month, filterable by property: billed, collected, collection rate, outstanding, overdue, advances, deposits held, expenses, net cash, occupancy; lists of overdue, due soon, move-outs and lease expiries. | MVP |
| REP-002 | Rent roll as of a date. | MVP |
| REP-003 | Outstanding and aging report (current, 1–30, 31–60, 61–90, 90+ days). | MVP |
| REP-004 | Collections report for a date range, by property, unit, tenant, method, account, recorded-by. | MVP |
| REP-005 | Tenant statement with opening balance, entries and running balance; PDF and CSV; shareable. | MVP |
| REP-006 | Deposit register. | MVP |
| REP-007 | Expense report by property, category and month. | MVP |
| REP-008 | Property income summary per month: billed, collected, expenses, net cash, occupancy. | MVP |
| REP-009 | Vacancy and lease-expiry reports. | MVP |
| REP-010 | Full data export: ZIP of CSV files for all entities. | MVP |
| REP-011 | Utility consumption report per meter and period. | V1 |
| REP-012 | PDF/XLSX report exports and scheduled email reports. | V1 |

### 9.19 Search and filtering (SRCH)

| ID | Requirement | Priority |
|---|---|---|
| SRCH-001 | Global search over tenant name, phone and email; unit label; property name and address; receipt number. | MVP |
| SRCH-002 | Lists support filters (property, status, date range, category, method) and a property filter that persists across Home, Money and Reports. | MVP |

### 9.20 Sync and offline (SYNC)

| ID | Requirement | Priority |
|---|---|---|
| SYNC-001 | The Android app reads and writes all synced workspace data offline. | MVP |
| SYNC-002 | Offline changes are queued and retried automatically with backoff until the server accepts or rejects them. | MVP |
| SYNC-003 | Retries never create duplicate records (idempotent operations). | MVP |
| SYNC-004 | The app downloads only changes since its last sync, including deletions. | MVP |
| SYNC-005 | Conflicts follow the rules of D-020: field-level last-write-wins, money entries immutable, rule violations rejected and shown to the user. | MVP |
| SYNC-006 | A sync status indicator and a sync-issues screen let the user retry, edit or discard failed changes. | MVP |
| SYNC-007 | Changes made on the website reach the app on app open, after local writes, every 15 minutes while online, and on pull-to-refresh. | MVP |
| SYNC-008 | Pending changes survive app restarts, sign-out attempts and expired sessions, and are never sent under another user's identity. | MVP |
| SYNC-009 | The server can require a minimum app version; older apps must update before syncing. | MVP |
| SYNC-010 | Push-triggered sync after changes by other users. | V1 |

### 9.21 Settings (SET)

| ID | Requirement | Priority |
|---|---|---|
| SET-001 | Workspace settings: name, country, default currency, time zone, rounding of calculated amounts, receipt prefix and footer, landlord details printed on documents, default digest time. | MVP |
| SET-002 | Display preferences: language (English at launch), number and date formats from locale. | MVP |
| SET-003 | Editable inspection checklist templates per workspace. | V1 |

### 9.22 Version 1 modules

| ID | Requirement | Priority |
|---|---|---|
| TPORTAL-001 | Invite a tenant to the portal by phone or email; one tenant user can see tenancies from several workspaces. | V1 |
| TPORTAL-002 | Tenant home: dues, ledger, receipts, documents shared with the tenant, landlord's payment instructions. | V1 |
| NOTICE-001 | Post notices (title, text, attachments) to all tenants, selected properties or selected units; push to tenants; see read status. | V1 |
| NOTICE-002 | Notice history, expiry and archive. | V1 |
| CHAT-001 | One chat per tenancy between its tenants and the workspace members with access; text, a few compressed images (no PDFs/documents, D-057), payment-details card; unread counts; push. | V1 |
| CHAT-002 | Report a message; retention per D-055; chat included in exports. | V1 |
| BILL-001 | Owner subscribes on the website; price based on billable properties (D-010). | V1 |
| BILL-002 | When unpaid, the workspace becomes read-only after a grace period; no data is ever deleted for non-payment. | V1 |
| BILL-003 | Beta workspaces convert with an early-user discount. | V1 |

## 10. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-001 | **Performance.** Android: cold start to cached Home < 2 s on a mid-range device (e.g. 4 GB RAM); lists of 2,000 rows scroll smoothly; local writes < 100 ms. API: p95 < 500 ms for reads, < 800 ms for writes in the hosting region. Web: first contentful paint < 2.5 s on 4G. |
| NFR-002 | **Scale.** MVP targets 1,000 workspaces; up to 2,000 units and 10 years of history per workspace; initial Android sync of a 500-unit workspace < 60 s on 4G. |
| NFR-003 | **Availability.** API 99.5% monthly (bounded by Vercel/Supabase SLAs). Android remains usable when the API is down. |
| NFR-004 | **Durability.** No accepted write is lost. Backups: RPO ≤ 24 h (≤ 2 min if point-in-time recovery is enabled), RTO ≤ 8 h. See 11 and 06. |
| NFR-005 | **Security.** As specified in `11_SECURITY_AND_PRIVACY.md`: TLS everywhere, workspace isolation, least privilege, audited sensitive access. |
| NFR-006 | **Localization-ready.** All UI strings externalized; numbers, dates and currency formatted with platform locale APIs; phones stored as E.164; RTL not in MVP. |
| NFR-007 | **Accessibility.** Web meets WCAG 2.1 AA; Android supports TalkBack with content descriptions and ≥ 48 dp touch targets; colour is never the only status signal. |
| NFR-008 | **Platforms.** Android 8.0+ (API 26+), phones in portrait and landscape; latest two versions of Chrome, Safari, Edge, Firefox; responsive from 360 px wide. |
| NFR-009 | **Money correctness.** Integer minor units; decimal/integer arithmetic only; deterministic rules in `10_FINANCIAL_RULES.md`; shared test vectors run on Android and server. |
| NFR-010 | **Auditability.** Every create, update, void, delete, sensitive view and export is recorded with actor, time, source and changed fields. |
| NFR-011 | **Cost.** Infrastructure ≤ about USD 60/month for the beta (approximate; see 06 §11). |
| NFR-012 | **Privacy compliance readiness.** Data export, deletion, consent-free minimal collection, privacy policy, and processor terms; **[LEGAL CHECK]** per launch country. |
| NFR-013 | **Observability.** Crash and error reporting on Android and server, structured logs with request IDs, uptime monitoring, alerting on job failures. |

## 11. User roles

Defined in `00_PRODUCT_DISCOVERY.md` §7 (Owner, Admin, Manager, Viewer in MVP; Staff, Tenant in V1). Every membership has either **all properties** or a list of **assigned properties**; Owner and Admin always have all properties.

## 12. Permissions

This matrix is the canonical source for authorization (API, sync, UI). "Scoped" means only for assigned properties.

| Capability | Owner | Admin | Manager | Viewer | Staff (V1) | Tenant (V1) |
|---|---|---|---|---|---|---|
| View properties, units, tenants, tenancies, ledger | All | All | Scoped | Scoped | Scoped | Own tenancies only |
| Create/edit/archive properties | Yes | Yes | Yes if all-properties access; edit scoped ones | No | No | No |
| Create/edit/archive units, owners, meters | Yes | Yes | Scoped | No | No | No |
| Create/edit tenants and tenancies, rent revisions, notice | Yes | Yes | Scoped | No | No | No |
| Record payments, charges, credits, refunds, readings, expenses | Yes | Yes | Scoped | No | Payments, readings, expenses (scoped) | Payment claims only |
| Void entries | Yes | Yes | Scoped | No | Own entries ≤ 24 h | No |
| Move-out and finalize settlement | Yes | Yes | Scoped | No | No | No |
| Reopen settlement, cancel tenancy with history | Yes | Yes | No | No | No | No |
| View sensitive documents | Yes | Yes | Scoped | No | No | Own documents |
| Other documents: view/upload | Yes | Yes | Scoped | View scoped | Upload scoped | Shared ones |
| Reports and CSV exports | All | All | Scoped | Scoped | No | Own statement |
| Full data export (ZIP) | Yes | Yes | No | No | No | No |
| Invite/manage members | Yes | Yes (not Owner) | No | No | No | No |
| Workspace settings, payment instructions | Yes | Yes | No | No | No | No |
| Audit log | Yes | Yes | No | No | No | No |
| Transfer ownership, delete workspace, billing | Yes | No | No | No | No | No |

## 13. Business rules

Exact formulas and examples are in `10_FINANCIAL_RULES.md`. Rules are numbered for reference by tests.

| ID | Rule |
|---|---|
| BR-001 | A workspace is the isolation boundary. No record, file, search result or report crosses workspaces. |
| BR-002 | Every property has exactly one ISO 4217 currency; all tenancies, meters and expenses of that property use it. |
| BR-003 | A property's currency cannot change once a tenancy exists on it. |
| BR-004 | A unit belongs to one property; unit labels are unique within a property (case-insensitive). |
| BR-005 | A unit's non-cancelled tenancies may not overlap. Occupancy runs from start date to move-out date, or planned move-out date, or open-ended. |
| BR-006 | A tenancy has exactly one unit, one currency and one primary tenant. |
| BR-007 | Rent periods are monthly and start on the tenancy's cycle day (1–28); a charge's due date = period start + grace days (0–60). |
| BR-008 | For each period start ≤ today (workspace time zone) from billing start date up to the move-out date, exactly one rent charge exists or has existed (voided charges are not re-created). |
| BR-009 | Money entries (charges, payments, credits, refunds, deposit applications) are never edited or deleted. Only note and reference may change. Corrections are void (with reason) + new entry. |
| BR-010 | Rent balance = rent-account charges + rent refunds − rent payments − credits − deposit applied. Positive = tenant owes; negative = advance credit. |
| BR-011 | Payments and credits settle rent-account charges oldest-due-first (FIFO). Charge status is derived, never stored. |
| BR-012 | Deposit held = deposit payments − deposit refunds − deposit applied. It may never be negative. |
| BR-013 | A deposit application may not exceed the deposit held or the positive rent balance at that moment. |
| BR-014 | A rent-account refund may not exceed the advance credit at that moment. |
| BR-015 | A tenancy becomes CLOSED when its settlement is finalized and both rent balance and deposit held are zero. CLOSED tenancies accept no money entries until the settlement is reopened. |
| BR-016 | Calculated amounts (proration, utilities, percentage fees) are rounded half-up to whole currency units, or to minor units if the workspace turns rounding off. |
| BR-017 | Meter readings may not decrease except across a recorded meter replacement (end + start readings). |
| BR-018 | Receipt numbers are sequential per workspace and assigned by the server when a payment is accepted; voided payments keep their number, marked VOID. Opening-balance and internal-transfer entries get no receipt. |
| BR-019 | Archived records are hidden from default lists but keep all history; hard deletion is allowed only for records with no dependent records. |
| BR-020 | A tenancy has at most one settlement that is DRAFT or FINALIZED. |
| BR-021 | Payment and refund dates may not be more than 1 day after today (workspace time zone). Payments may precede the tenancy start date by up to 365 days (booking amounts). |
| BR-022 | Sensitive documents are visible only per the permissions matrix; each view generates an audit event. |
| BR-023 | Every write records the acting user and source (web, android, job, system). |
| BR-024 | Rent revisions take effect from a period start date. Already-generated charges are never changed; the app proposes adjustment charges or credits for confirmation. |
| BR-025 | Account and workspace deletion take effect after a 30-day grace period, after which data and files are purged. |
| BR-026 | The move-in date, cycle day and billing start date cannot change after the first payment is recorded; to fix them, cancel (if allowed) or end and restart the tenancy. |

## 14. Success metrics

Proposed targets for the free beta (to be confirmed by the owner):

| Metric | Definition | Target |
|---|---|---|
| Activation | New workspaces with ≥ 1 tenancy within 24 h of sign-up | ≥ 60% |
| Time to first tenancy | Median minutes from sign-up to first tenancy | ≤ 10 min |
| Real usage | Payments recorded per month ÷ active tenancies, per active workspace | ≥ 0.8 |
| Retention | Workspaces active in month 3 ÷ workspaces created | ≥ 40% |
| Sync health | Ops accepted on first attempt | ≥ 99% |
| Money correctness | Balance-related bug reports | 0 open at any time |
| Stability | Crash-free sessions (Android) | ≥ 99.5% |
| Beta scale | Landlords / units tracked by end of beta | 20 landlords / 500 units |

## 15. Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | Sync bugs corrupt or duplicate money records | Critical | Append-only ledger, idempotent ops, server-side invariants, scenario tests (08, 14) |
| R-02 | Breach or leak of ID documents | Critical | Private storage, signed URLs, role checks, audit, minimal data (11) |
| R-03 | Solo developer capacity, scope creep | High | Strict MVP list, V1 holds everything else, milestone acceptance criteria (15) |
| R-04 | Non-technical landlords find data entry heavy | High | Bulk unit creation, existing-tenancy wizard, prefilled payment sheet, readings round |
| R-05 | Legal differences by country (deposits, IDs, privacy) | High | Record-only stance, legal review before public launch, disclaimers |
| R-06 | Provider dependency (Supabase, Vercel) | Medium | Standard PostgreSQL, off-site backups, no provider-specific business logic |
| R-07 | Play Store policy rejection (data safety, account deletion, billing) | Medium | Deletion flow in app and web, accurate data-safety form, web billing check (D-046) |
| R-08 | Pricing unit mismatch (per property) | Medium | Decide D-010 before V1 |
| R-09 | iPhone users unserved | Medium | Responsive website; KMP-based iOS later |
| R-10 | Two money-engine implementations drift (Kotlin, SQL/TS) | High | One shared test-vector file run in both CI pipelines |

## 16. Assumptions

| ID | Assumption |
|---|---|
| A-01 | Landlord users have an Android 8+ phone or a browser. |
| A-02 | Connectivity is intermittent in some properties (basements, rural sites). |
| A-03 | Most workspaces have fewer than 200 units. |
| A-04 | English is acceptable for early users. |
| A-05 | Rent is charged monthly. |
| A-06 | A property's income is in one currency. |
| A-07 | The landlord (workspace) is the data controller for tenant data; the product is the processor. **[LEGAL CHECK]** |
| A-08 | Landlords have a Google account or an email address. |
| A-09 | WhatsApp or SMS is available to share messages in the main markets. |
| A-10 | Tenants pay outside the app; the landlord confirms receipt by recording it. |

## 17. Open questions

All open items are tracked in the Decision Register (`00_PRODUCT_DISCOVERY.md`) and `16_DECISION_LOG.md`. The ones needed before development: D-012, D-014, D-020, D-021, D-022 (please confirm), D-030 (hosting region).
