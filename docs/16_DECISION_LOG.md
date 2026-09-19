# 16 — Decision Log

```text
Version:      0.1
Status:       Living document
Last Updated: 2026-09-19
Depends On:   00_PRODUCT_DISCOVERY.md (Decision Register)
Affected By:  every owner answer and every change request
```

## How to use this log

- Every architecture, product, financial, legal or technical decision gets an entry. The one-line summary also goes in the register in `00_PRODUCT_DISCOVERY.md`.
- **Status:** CONFIRMED (owner agreed) · PROVISIONAL (reasoned default, owner may change) · REQUIRES DECISION (open; a default may exist but must not be built on without confirmation).
- **Never delete or rewrite an entry.** To change a decision, add a new entry that says `Supersedes: D-xxx`, set the old one to `SUPERSEDED by D-yyy`, update every document listed in "Affected documents", and bump those documents' versions.
- Sources of owner confirmation: **TO DO LIST answers** (Q1–Q16, 00 §1.1), **idea notes** (00 §1.2), **Q&A 2026-09-18** (00 §1.3).

## Product and business

```text
Decision ID:        D-001
Date:               2026-09-18
Decision:           Primary customers
Status:             CONFIRMED (TO DO LIST Q1: "for both")
Options considered: individual landlords only; property managers only; both
Selected approach:  Both individual landlords and property managers/small agencies
Reason:             Owner answer; both share the same record-keeping problem
Consequences:       Workspace + team model with roles and property scoping; owners stored as records
Affected documents: 00, 01, 04, 05, 11
```

```text
Decision ID:        D-002
Date:               2026-09-18
Decision:           Launch market
Status:             CONFIRMED (TO DO LIST Q9: "no for all over the world")
Options considered: India first; global from launch
Selected approach:  Global from launch
Reason:             Owner answer
Consequences:       Multi-currency, locale-based formatting, E.164 phones, workspace time zones,
                    several privacy laws to review, iOS gap to address (D-007)
Affected documents: 00, 01, 06, 09, 10, 11
```

```text
Decision ID:        D-003
Date:               2026-09-18
Decision:           UI language at launch
Status:             PROVISIONAL
Options considered: English only; English + Hindi; several languages
Selected approach:  English only; all strings externalized from day one
Reason:             Smallest launch; localization later without code changes
Consequences:       Non-English speakers underserved until translations are added
Affected documents: 01, 06, 09
```

```text
Decision ID:        D-004
Date:               2026-09-18
Decision:           Payments recorded vs collected
Status:             CONFIRMED (TO DO LIST Q8: "merely recorded")
Options considered: record payments made elsewhere; collect through a payment gateway
Selected approach:  Record only; the app never holds or moves money
Reason:             Owner answer; avoids gateway integration, payouts, KYC, PCI scope and
                    money-transmission regulation
Consequences:       Payment instructions + share links in MVP; payment QR in V1 chat; online
                    collection is a Future option
Affected documents: 00, 01, 02, 10, 11
```

```text
Decision ID:        D-005
Date:               2026-09-18
Decision:           Timing of tenant login, notice board and landlord–tenant chat
Status:             CONFIRMED (Q&A 2026-09-18)
Options considered: all in MVP; tenant view + notices in MVP, chat in V1; all in V1
Selected approach:  All in V1, after the landlord MVP; database tenant-ready from day one
Reason:             Chat alone is a sub-product (realtime, media, push, moderation); MVP must stay
                    buildable by one developer
Consequences:       MVP reminders/receipts/QR go through the landlord's WhatsApp/SMS; tenant tables
                    and flags reserved; tenant notifications arrive in V1
Affected documents: 00, 01, 02, 05, 12, 15
```

```text
Decision ID:        D-007
Date:               2026-09-18
Decision:           iOS support
Status:             PROVISIONAL
Options considered: native iOS app now; cross-platform app; responsive website for iPhone users
Selected approach:  Responsive website for iPhone users; iOS app later via Kotlin Multiplatform
Reason:             Follows D-006; avoids a second mobile codebase before product-market fit
Consequences:       Website must be fully usable at 360 px; iPhone users have no offline mode
Affected documents: 00, 01, 06, 09
```

```text
Decision ID:        D-008
Date:               2026-09-18
Decision:           Who pays
Status:             CONFIRMED (idea notes: "pay only by the owner not by the tenant")
Options considered: workspace owner; tenant; both
Selected approach:  Workspace owner only; tenants always free
Reason:             Owner's business model
Consequences:       Tenant features must never be paywalled
Affected documents: 00, 01, 15
```

```text
Decision ID:        D-009
Date:               2026-09-18
Decision:           When billing starts
Status:             CONFIRMED (Q&A 2026-09-18)
Options considered: paid from launch; freemium from launch; free beta then billing in V1
Selected approach:  Free beta; per-property billing on the website in V1
Reason:             Learn what landlords value before building billing
Consequences:       No payment code in MVP; `workspaces.plan` reserved
Affected documents: 01, 05, 15
```

```text
Decision ID:        D-010
Date:               2026-09-18
Decision:           Pricing unit and price points
Status:             SUPERSEDED by D-056 (2026-09-19)
Options considered: per property (owner's idea); per unit; per property with unit bands
Selected approach:  (recommended) per property with unit bands, or per unit with a free allowance
Reason:             Flat per-property pricing charges a 60-flat building the same as a 1-room house
Consequences:       Only affects the billing quantity calculation (BILL-001)
Affected documents: 00, 01, 02, 15
```

```text
Decision ID:        D-011
Date:               2026-09-18
Decision:           Voice recordings
Status:             CONFIRMED (Q&A 2026-09-18: "not for now")
Options considered: voice notes on records in MVP; voice messages in chat; later
Selected approach:  Not in MVP or V1; revisit after launch
Reason:             Text, photos and documents cover the need; voice adds storage, player UI and
                    privacy questions
Consequences:       No RECORD_AUDIO permission
Affected documents: 00, 01
```

```text
Decision ID:        D-039
Date:               2026-09-18
Decision:           Product name and branding
Status:             REQUIRES DECISION (optional)
Options considered: —
Selected approach:  Working title "Rent Manager" until decided (earlier "Bunkwise Rent" notes are not binding)
Reason:             Owner's choice
Consequences:       Package id, domain and store listing depend on it (needed by M8)
Affected documents: 00, 06
```

```text
Decision ID:        D-042
Date:               2026-09-18
Decision:           Maintenance requests module
Status:             PROVISIONAL
Options considered: MVP; V1; Future
Selected approach:  Future; repairs recorded as expenses in MVP; tenant requests via chat in V1
Reason:             Keeps MVP focused on money records
Consequences:       No ticket tracking until after V1
Affected documents: 01, 02
```

```text
Decision ID:        D-043
Date:               2026-09-18
Decision:           CSV import of tenants and tenancies
Status:             PROVISIONAL
Options considered: MVP; V1
Selected approach:  V1
Reason:             Bulk unit creation and the existing-tenancy wizard cover MVP onboarding
Consequences:       Large portfolios onboard more slowly during beta
Affected documents: 01, 15
```

```text
Decision ID:        D-046
Date:               2026-09-18
Decision:           How Android users buy subscriptions
Status:             REQUIRES DECISION (verify Google Play Payments policy before V1)
Options considered: Google Play Billing in app; purchase on the website only
Selected approach:  (recommended) website-only purchase; the app shows plan status without purchase
                    buttons or links, if the current policy allows
Reason:             Avoids store fees and a second billing integration
Consequences:       Policy verification needed; fallback is Play Billing for in-app purchase
Affected documents: 00, 15
```

```text
Decision ID:        D-054
Date:               2026-09-18
Decision:           Billing provider (V1)
Status:             REQUIRES DECISION (before V1)
Options considered: merchant of record (Paddle, Lemon Squeezy); Stripe; Razorpay
Selected approach:  (recommended) merchant of record
Reason:             Handles global sales tax/VAT for a solo business
Consequences:       Higher fee per transaction than Stripe
Affected documents: 15
```

## Domain and data model

```text
Decision ID:        D-012
Date:               2026-09-18
Decision:           Currency scope
Status:             CONFIRMED by the owner 2026-09-20
Options considered: one currency per workspace; per property; per tenancy
Selected approach:  Per property (ISO 4217), locked once a tenancy exists; tenancies inherit;
                    integer minor units; no FX conversion
Reason:             Supports owners with properties in several countries without per-record complexity
Consequences:       Totals always per currency; dashboard currency switch; expenses use property currency
Affected documents: 01, 04, 05, 10, 13
```

```text
Decision ID:        D-013
Date:               2026-09-18
Decision:           Property hierarchy
Status:             PROVISIONAL
Options considered: Property → Building → Floor → Unit; Property → Unit with grouping labels
Selected approach:  Property → Unit, with an optional floor/block label on units
Reason:             Fewer levels to navigate and store; labels give the grouping landlords need
Consequences:       Multi-building complexes use one property per building or block labels
Affected documents: 00, 04, 05, 09
```

```text
Decision ID:        D-014
Date:               2026-09-18
Decision:           Unit and co-tenant model
Status:             CONFIRMED by the owner 2026-09-20
Options considered: several concurrent tenancies per unit (capacity); one tenancy per unit with co-tenants
Selected approach:  A unit is what is rented for one rent; at most one tenancy occupies it at a time;
                    co-tenants/family share that tenancy; PG beds or separately billed rooms are units
Reason:             Clear, enforceable rule (exclusion constraint); covers both meanings of Q4
Consequences:       PG owners create bed-level units; shared-meter split arrives in V1
Affected documents: 00, 03, 04, 05, 10
```

```text
Decision ID:        D-015
Date:               2026-09-18
Decision:           Tenant ↔ tenancy relationship
Status:             CONFIRMED (Q5)
Options considered: one tenancy per tenant; many
Selected approach:  Many, concurrent and historical, through tenancy parties
Reason:             Owner answer
Consequences:       Tenant is workspace-level; scoped visibility rule for tenants (04 §4.6)
Affected documents: 04, 05
```

```text
Decision ID:        D-016
Date:               2026-09-18
Decision:           Owner (legal owner) model
Status:             PROVISIONAL (multiple owners CONFIRMED by Q6)
Options considered: owners must be users; owners are records
Selected approach:  Owner records with shares (basis points, total 100%); optionally invited as
                    scoped Viewers
Reason:             Many owners never log in; managers need owner data for statements
Consequences:       Owner statements (V1) use shares
Affected documents: 04, 05, 13
```

```text
Decision ID:        D-017
Date:               2026-09-18
Decision:           Roles and access
Status:             PROVISIONAL (restricted access CONFIRMED by Q14)
Options considered: fixed roles; custom roles
Selected approach:  Owner, Admin, Manager, Viewer in MVP; Staff and Tenant in V1; Manager/Viewer
                    may be limited to selected properties
Reason:             Covers stated needs with a small, testable matrix
Consequences:       Permissions matrix (01 §12) is the single source for API, sync and UI
Affected documents: 01, 07, 08, 11, 14
```

```text
Decision ID:        D-021
Date:               2026-09-18
Decision:           Financial model
Status:             CONFIRMED by the owner 2026-09-20
Options considered: paid/unpaid flags per month; payments explicitly allocated to charges;
                    append-only ledger with derived FIFO allocation
Selected approach:  Per-tenancy append-only ledger with RENT and DEPOSIT accounts; payments and
                    credits settle charges oldest-due-first (tie-break: category rank, then id);
                    statuses and balances derived; deposit payments may not exceed deposit due
Reason:             Deterministic, auditable, conflict-free offline (no allocation records to merge),
                    handles partial, multiple and advance payments naturally
Consequences:       A landlord cannot direct a payment to a newer month while older ones are unpaid
                    (the note field records intentions); two implementations (Kotlin, SQL/TS) kept
                    identical by shared test vectors
Affected documents: 04, 05, 07, 10, 13, 14
```

```text
Decision ID:        D-022
Date:               2026-09-18
Decision:           Rent periods, due dates and proration
Status:             CONFIRMED by the owner 2026-09-20
Options considered: calendar months only; move-in anniversary only; configurable cycle day;
                    30-day-month proration basis vs actual days
Selected approach:  Monthly periods starting on a cycle day 1–28; due date = period start + grace
                    days (0–60); partial periods prorated by actual days, rounded half-up to whole
                    currency units (workspace setting); rent changes only from period starts
Reason:             Covers both common practices; days 29–31 excluded so every month has the day
Consequences:       Mid-period rent changes and cycle-day changes after payments are not supported
Affected documents: 02, 05, 10
```

```text
Decision ID:        D-024
Date:               2026-09-18
Decision:           Utility (electricity/water/gas) calculation
Status:             PROVISIONAL (manual entry integrated into dues CONFIRMED by Q10)
Options considered: bill amount entry only; readings × single rate + fixed charge; tariff slabs
Selected approach:  Manual readings → consumption × rate + fixed charge, proposed and confirmed;
                    rate snapshotted on the charge; bill-amount charges when no meter; meter
                    replacement handled with end/start readings; slabs later
Reason:             Owner answer; covers sub-metered buildings and bill pass-through
Consequences:       Shared meters split in V1; tariff slabs Future
Affected documents: 02, 05, 10
```

```text
Decision ID:        D-040
Date:               2026-09-18
Decision:           Handling local customs (proration, move-out charges)
Status:             PROVISIONAL
Options considered: configuration flags per workspace/tenancy; app proposes, user edits before saving
Selected approach:  Proposals with editable amounts (move-in charges, settlement lines, revision
                    adjustments)
Reason:             No configuration matrix to build and test; the landlord's intent is recorded
Consequences:       Saved amounts may differ from calculated ones (by design)
Affected documents: 02, 10
```

```text
Decision ID:        D-041
Date:               2026-09-18
Decision:           Onboarding tenancies that started before the app
Status:             PROVISIONAL
Options considered: back-generate all history; billing start date + opening balances
Selected approach:  Billing start (a cycle start) + opening arrears/advance + deposit already held
Reason:             Landlords digitize mid-tenancy and rarely know full history
Consequences:       History before billing start is a single opening line
Affected documents: 02, 03, 10
```

```text
Decision ID:        D-044
Date:               2026-09-18
Decision:           Time zone scope
Status:             PROVISIONAL
Options considered: per workspace; per property
Selected approach:  Per workspace (IANA name)
Reason:             Business dates have no time; a different zone shifts "today" by at most a day
Consequences:       Portfolios spanning time zones may see due/overdue one day off
Affected documents: 04, 10, 12
```

```text
Decision ID:        D-051
Date:               2026-09-18
Decision:           Rent frequency
Status:             PROVISIONAL
Options considered: monthly only; weekly/quarterly/yearly too
Selected approach:  Monthly only in MVP
Reason:             Matches the stated market; other cycles complicate periods and proration
Consequences:       Quarterly commercial rents must be entered as manual charges until supported
Affected documents: 01, 10
```

```text
Decision ID:        D-052
Date:               2026-09-18
Decision:           Recurring fixed monthly charges
Status:             PROVISIONAL
Options considered: manual entry each month; recurring definitions per tenancy
Selected approach:  Recurring definitions (maintenance, parking, …) generated with rent
Reason:             Very common alongside rent; the generation job already exists
Consequences:       One extra table and generated-key pattern
Affected documents: 01, 05, 10
```

## Offline, sync and conflicts

```text
Decision ID:        D-018
Date:               2026-09-18
Decision:           Android offline behaviour
Status:             CONFIRMED (Q15: "task stored and later retry")
Options considered: online only; read-only offline; full offline with queued writes
Selected approach:  Full offline for synced data; every write queued and retried automatically
Reason:             Owner answer; poor signal in buildings
Consequences:       Outbox, idempotent ops, sync issues UI (08)
Affected documents: 08
```

```text
Decision ID:        D-019
Date:               2026-09-18
Decision:           Website offline behaviour
Status:             PROVISIONAL
Options considered: online only; offline PWA
Selected approach:  Online only
Reason:             A second offline client doubles sync complexity for little value
Consequences:       Clear offline message on the website
Affected documents: 06, 08, 09
```

```text
Decision ID:        D-020
Date:               2026-09-18
Decision:           Resolving simultaneous edits
Status:             CONFIRMED (owner, 2026-09-19); applies to web too (two members editing at once)
Options considered: record-level last-write-wins; field-level last-write-wins by server arrival;
                    field-level by device timestamp; reject stale edits + manual merge
Selected approach:  Field-level last-write-wins by server arrival order; money entries append-only
                    (never overwritten, duplicates flagged); rule violations rejected and shown;
                    delete wins over edits
Reason:             Satisfies "one wins" without trusting device clocks, without losing unrelated
                    field edits, and without ever losing money records
Consequences:       A long-offline phone can overwrite a newer web edit of the same field (audit
                    log keeps both values)
Affected documents: 07, 08, 14
```

```text
Decision ID:        D-023
Date:               2026-09-18
Decision:           Where rent charges are generated
Status:             PROVISIONAL
Options considered: on devices; on the server; both with deterministic ids
Selected approach:  Server hourly job (idempotent generated keys); tenancy start creates the first
                    periods atomically
Reason:             One generator = no duplicates; simpler Android
Consequences:       An offline phone sees a new month's charge only after syncing; payments recorded
                    before that show as advance until then
Affected documents: 06, 08, 10
```

```text
Decision ID:        D-034
Date:               2026-09-18
Decision:           Record identifiers
Status:             PROVISIONAL
Options considered: server serial ids; client-generated UUIDs
Selected approach:  UUID v4 generated by whoever creates the record
Reason:             Offline creation with final ids; retries are harmless
Consequences:       No human-readable ids except receipt numbers
Affected documents: 05, 07, 08
```

```text
Decision ID:        D-035
Date:               2026-09-18
Decision:           Sync protocol
Status:             PROVISIONAL
Options considered: timestamp-based pull; CRDTs; third-party sync engine (PowerSync, ElectricSQL);
                    Firestore offline persistence; per-workspace version cursor + op queue
Selected approach:  Per-workspace change sequence (row-locked counter) stamped on every write;
                    cursor pull without split versions; op-based push with op_id idempotency;
                    tombstones with purge floor
Reason:             Correct ordering without clocks, standard PostgreSQL, no extra service
Consequences:       Writes within one workspace are serialized (acceptable at expected load)
Affected documents: 05, 07, 08
```

## Technology and operations

```text
Decision ID:        D-006
Date:               2026-09-18
Decision:           Technology stack
Status:             CONFIRMED (Q&A 2026-09-18)
Options considered: Kotlin + Next.js + PostgreSQL (Supabase); React Native + Next.js + PostgreSQL;
                    Kotlin app + Supabase only; Firebase
Selected approach:  Native Android (Kotlin) + Next.js (website and REST API) + PostgreSQL on
                    Supabase (Auth, Storage)
Reason:             Owner's existing skills; relational ledger and constraints; one backend codebase
Consequences:       Two UI codebases; money engine in Kotlin and SQL/TS kept equal by vectors
Affected documents: 06, 07, 08, 14, 15
```

```text
Decision ID:        D-026
Date:               2026-09-18
Decision:           Sign-in methods
Status:             PROVISIONAL
Options considered: email + password; Google; email one-time code; phone one-time code
Selected approach:  Google + email code in MVP; phone code in V1 (tenants)
Reason:             No password handling; SMS costs deferred until tenants need it
Consequences:       Landlords need a Google account or email
Affected documents: 06, 11
```

```text
Decision ID:        D-027
Date:               2026-09-18
Decision:           Receipt numbering
Status:             PROVISIONAL
Options considered: per-device number ranges; server sequence; codes derived from UUIDs
Selected approach:  Server sequence per workspace, assigned when the payment is accepted
Reason:             Sequential, gap-free, familiar to landlords and accountants
Consequences:       Receipts cannot be shared until the payment has synced
Affected documents: 07, 08, 10
```

```text
Decision ID:        D-028
Date:               2026-09-18
Decision:           Notification channels in MVP
Status:             PROVISIONAL
Options considered: push; email; SMS; WhatsApp Business API
Selected approach:  Push digest + in-app + transactional email; tenant messages via the landlord's own
                    WhatsApp/SMS share links
Reason:             No per-message cost; no template approvals
Consequences:       No automated tenant reminders until V1/Future
Affected documents: 12
```

```text
Decision ID:        D-029
Date:               2026-09-18
Decision:           Late fees
Status:             PROVISIONAL
Options considered: manual; automatic rule
Selected approach:  Manual in MVP; automatic rule in V1 with auto-void for backdated payments
Reason:             Correct automation with offline payments needs as-of logic; legal limits vary
Consequences:       Landlords add late fees by hand during beta
Affected documents: 10, 12
```

```text
Decision ID:        D-030
Date:               2026-09-18
Decision:           Hosting region
Status:             CONFIRMED by the owner 2026-09-20: Mumbai
Options considered: Mumbai (ap-south-1); Singapore; Frankfurt; US East
Selected approach:  Mumbai: Supabase ap-south-1, Vercel functions bom1
Reason:             Latency and data-protection transfer rules
Consequences:       Vercel function region must match; privacy policy states the location
Affected documents: 06, 11
```

```text
Decision ID:        D-031
Date:               2026-09-18
Decision:           Android UI toolkit and minimum version
Status:             PROVISIONAL
Options considered: XML Views (used in owner's earlier apps); Jetpack Compose
Selected approach:  Jetpack Compose + Material 3; minSdk 26 (Android 8.0)
Reason:             Current Android standard; java.time available natively from API 26
Consequences:       Learning time if Compose is new to the owner
Affected documents: 06, 09
```

```text
Decision ID:        D-032
Date:               2026-09-18
Decision:           Web UI stack
Status:             PROVISIONAL
Options considered: Next.js App Router + Tailwind + shadcn/ui; other React UI kits
Selected approach:  Next.js App Router, Tailwind CSS, shadcn/ui, react-hook-form + Zod, TanStack Table
Reason:             Owner knows Next.js; copy-in components keep dependencies small
Consequences:       —
Affected documents: 06, 09
```

```text
Decision ID:        D-033
Date:               2026-09-18
Decision:           Data access and database exposure
Status:             PROVISIONAL
Options considered: clients use Supabase client + RLS policies; server-only ORM access
Selected approach:  Drizzle ORM on the server only; app tables in a non-exposed `app` schema; RLS
                    enabled with no policies (deny all client roles)
Reason:             One enforcement point (the API) plus defence in depth
Consequences:       Every client read and write goes through the API
Affected documents: 05, 06, 11
```

```text
Decision ID:        D-036
Date:               2026-09-18
Decision:           Export formats
Status:             PROVISIONAL
Options considered: CSV; XLSX; PDF; ZIP of everything
Selected approach:  CSV for all reports, streamed ZIP of CSVs for full export, PDFs for receipts,
                    statements and settlements; XLSX/PDF reports in V1
Reason:             Accountant-friendly with the least code
Consequences:       Document files not in the MVP export (list only)
Affected documents: 13
```

```text
Decision ID:        D-037
Date:               2026-09-18
Decision:           Account and workspace deletion
Status:             PROVISIONAL (verify store and legal requirements)
Options considered: immediate deletion; grace period then purge
Selected approach:  30-day grace (cancellable), then purge of data and files
Reason:             Recovery from mistakes; store policy requires in-app and web deletion
Consequences:       Backups hold data until they expire (stated in privacy policy)
Affected documents: 03, 11
```

```text
Decision ID:        D-038
Date:               2026-09-18
Decision:           Protection of data on Android devices
Status:             PROVISIONAL
Options considered: SQLCipher database encryption; OS file-based encryption + app-private storage
Selected approach:  OS encryption, app-private storage, encrypted tokens, optional biometric lock,
                    sensitive documents never persisted
Reason:             Adequate for the threat model without an extra crypto dependency
Consequences:       Revisit if a customer or regulation requires app-level encryption
Affected documents: 11
```

```text
Decision ID:        D-047
Date:               2026-09-18
Decision:           Scale target
Status:             PROVISIONAL
Options considered: —
Selected approach:  ≤ 2,000 units per workspace fully synced to Android; 1,000 workspaces in MVP
Reason:             Covers the target customers with full offline data
Consequences:       Larger portfolios need partial sync later
Affected documents: 01, 08, 14
```

```text
Decision ID:        D-048
Date:               2026-09-18
Decision:           Backups
Status:             PROVISIONAL
Options considered: provider backups only; provider + off-site copies
Selected approach:  Supabase daily backups + weekly encrypted off-site database dump + weekly storage
                    mirror; quarterly restore drill; add point-in-time recovery with paying customers
Reason:             Recovery that does not depend on a single provider
Consequences:       Small storage cost; a key the owner must keep safe
Affected documents: 06, 11
```

```text
Decision ID:        D-049
Date:               2026-09-18
Decision:           Rate limiting
Status:             PROVISIONAL
Options considered: application-level limiter (e.g. Redis); platform-level rules
Selected approach:  Supabase Auth limits + hosting firewall rules + request size/batch limits
Reason:             No extra service until abuse appears
Consequences:       Add an app-level limiter if needed
Affected documents: 06, 11
```

```text
Decision ID:        D-050
Date:               2026-09-18
Decision:           Build order
Status:             CONFIRMED (owner, 2026-09-19): website first; beta users use it on phones
Options considered: Android first; web first; parallel
Selected approach:  Core + website first; Android built on the sync layer from its first screen
Reason:             Validates the domain online first; avoids retrofitting sync
Consequences:       Early beta users use the website on phones
Affected documents: 15
```

```text
Decision ID:        D-053
Date:               2026-09-18
Decision:           Storage quota
Status:             PROVISIONAL
Options considered: unlimited; fixed quota per workspace
Selected approach:  1 GB per workspace during beta
Reason:             Cost control (~3,000 compressed photos)
Consequences:       Quota warnings at 80% and 100%
Affected documents: 05, 11, 12
```

## Legal and compliance

```text
Decision ID:        D-025
Date:               2026-09-18
Decision:           Storing identity documents
Status:             CONFIRMED (owner, 2026-09-19): user-uploaded files kept in private storage, never a public URL; privacy policy still needs [LEGAL CHECK]
Options considered: store files and numbers; store files only; store nothing
Selected approach:  Store files, never full ID numbers (type + last 4 only); sensitive flag; role
                    restriction; audited views; short-lived URLs
Reason:             Owner answer + data minimization
Consequences:       In-app guidance to store only what is needed (e.g. masked Aadhaar)
Affected documents: 02, 05, 11
```

```text
Decision ID:        D-045
Date:               2026-09-18
Decision:           Country-specific rules (deposit caps and interest, late-fee limits, notice rules)
Status:             CONFIRMED (owner, 2026-09-19): the workspace authority (Owner/Admin/Manager) sets deposits, late fees and notice; the app never enforces local law
Options considered: encode rules per country; record only
Selected approach:  Record what the landlord enters; no compliance claims
Reason:             Rules differ by country and state and change often
Consequences:       Disclaimers in terms; automatic late fees off by default
Affected documents: 00, 10, 11
```

```text
Decision ID:        D-055
Date:               2026-09-18
Decision:           Chat message retention (V1)
Status:             REQUIRES DECISION (before V1)
Options considered: keep forever; keep for tenancy lifetime + N years
Selected approach:  (proposal) tenancy lifetime + 1 year
Reason:             Dispute evidence vs privacy
Consequences:       Purge job extension in V1
Affected documents: 02, 11
```

```text
Decision ID:        D-056
Date:               2026-09-19
Decision:           Pricing unit and packages (V1 billing)
Status:             CONFIRMED model (owner, 2026-09-19); price points still open
Supersedes:         D-010
Options considered: per property; per unit; per property with unit bands; per property with a unit cap
Selected approach:  Billing counts properties. One property covers up to 50 units; a larger building
                    counts as ceil(units / 50) properties (e.g. 120 units = 3). Sold as packages of
                    10, 50 and 100 properties; above 100 = custom.
Reason:             Keeps the owner's simple per-property idea while stopping a 300-flat building from
                    paying the same as a house
Consequences:       BILL-001 quantity = sum over active properties of ceil(active units / 50);
                    package limit checked on property/unit creation (warn, then read-only after grace)
Affected documents: 00, 01, 02, 15
```

```text
Decision ID:        D-057
Date:               2026-09-19
Decision:           Chat scope (V1)
Status:             CONFIRMED (owner, 2026-09-19)
Options considered: text + photos + PDFs; text + photos; text only
Selected approach:  Chat is for conversation. Text messages; images allowed but discouraged and
                    compressed/capped; no document/PDF attachments (documents live in Documents)
Reason:             Media storage and delivery are the main cost of chat
Consequences:       V1 chat screen drops PDF attachments; image cap and compression set at V1 design
Affected documents: 00, 02, 09
```

```text
Decision ID:        D-058
Date:               2026-09-19
Decision:           Local development database and sign-in until the hosting region is chosen
Status:             PROVISIONAL (temporary; ends when D-030 is decided)
Options considered: wait for Supabase before building; local Postgres install; embedded Postgres (PGlite)
Selected approach:  Embedded Postgres (PGlite) in web/.data, same Drizzle schema and SQL migrations as
                    Supabase will use; one local user and workspace created on /setup (no sign-in yet)
Reason:             Lets the website be built and used now without choosing a region or paying for hosting
Consequences:       Moving to Supabase = swap the connection file, add Supabase Auth and the workspace
                    switcher; data in web/.data is for testing only (delete the folder to start over).
                    Rent generation runs when pages load instead of the hourly job (06 §9) until deployed
Affected documents: 06, 15
```

## Change history

| Date | Change |
|---|---|
| 2026-09-18 | Initial log (D-001…D-055) created from the TO DO LIST answers, idea notes and the owner Q&A of 2026-09-18 |
| 2026-09-19 | Owner review of 00 §14: D-020, D-025, D-045, D-050 CONFIRMED; D-010 superseded by D-056 (pricing); D-057 added (chat scope) |
| 2026-09-19 | D-058 added: local embedded database and single local user until the hosting region (D-030) is chosen |
