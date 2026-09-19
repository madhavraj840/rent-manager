# 00 — Product Discovery

```text
Version:      0.1
Status:       Draft — awaiting owner review
Last Updated: 2026-09-19
Depends On:   TO DO LIST.txt (master prompt + answers), rent application/idea and featuers.txt,
              owner Q&A of 2026-09-18
Affected By:  16_DECISION_LOG.md (any decision change must be reflected here)
```

## Purpose

This document records what we know about the product, what the owner has confirmed, what is still open, and every decision that shapes the architecture. All later documents (01–19) build on it.

**Working title:** "Rent Manager" (placeholder until D-039 is decided).

**One-line product definition:** An Android app plus a website that lets landlords and property managers keep all their rental records in one place. That covers properties, units, tenants, tenancies, rent, payments, deposits, utilities, expenses, documents, move-in and move-out. Both clients share one backend, so the same data appears on the phone and on the web.

## Sources

| Source | Used for | Weight |
|---|---|---|
| `TO DO LIST.txt`: master prompt | Process, required documents, requirement areas | Binding process |
| `TO DO LIST.txt`: answers at the end (16 questions) | Discovery answers | CONFIRMED where clear |
| `rent application/idea and featuers.txt` (2026-09-18) | Owner/tenant sharing, notice board, photo proof, owner-pays, per-property pricing | CONFIRMED intent |
| Owner Q&A, 2026-09-18 (4 questions) | Tenant app timing, stack, billing timing, voice notes | CONFIRMED |
| `rent_app/` folder (July 2026) | Ideas only (UX principles, meter photos, checklist, design tokens) | **Not binding.** The owner stated these decisions are outdated. |

## 1. Answers received

### 1.1 From the TO DO LIST (verbatim answers)

| # | Question | Answer (verbatim) | Interpretation | Status |
|---|---|---|---|---|
| Q1 | Only landlords, or also property managers? | "for both" | Primary customers are landlords **and** property managers | CONFIRMED |
| Q2 | Can one landlord have multiple properties? | "yes" | Many properties per account | CONFIRMED |
| Q3 | Can one property have multiple units? | "yes" | Property contains units | CONFIRMED |
| Q4 | Can a unit have multiple tenants? | "yes" | Co-tenants on one tenancy; separately billed beds/rooms are modelled as units (D-014) | CONFIRMED (model PROVISIONAL) |
| Q5 | Can a tenant occupy multiple units? | "yes" | One tenant can hold several tenancies at the same time | CONFIRMED |
| Q6 | Can properties have multiple owners? | "yes" | Property has 1..n owners with shares | CONFIRMED |
| Q7 | Will tenants have their own accounts? | "probably" | Later resolved by Q&A: tenant login in V1 | CONFIRMED (V1) |
| Q8 | Payments collected in-app or merely recorded? | "merely recorded — there will be a chat interface where user can chat and there they can send qr and other things" | No payment gateway. Landlord–tenant chat (V1) carries the payment QR and proofs | CONFIRMED |
| Q9 | India initially? | "no for all over the world" | Global from launch: multi-currency, locale formats, E.164 phones | CONFIRMED |
| Q10 | Electricity/water: manual or integrated with bills? | "manually entered and then integrated in final amount" | Manual meter readings or bill amounts become charges in the tenant's balance and final settlement | CONFIRMED |
| Q11 | Store documents such as Aadhaar and rental agreements? | "yes" | Store ID and agreement files, with safeguards (D-025) | CONFIRMED |
| Q12 | Multiple currencies? | "yes" | Currency per property (D-012) | CONFIRMED (scope PROVISIONAL) |
| Q13 | Multiple landlords/users? | "yes" | Multi-tenant SaaS: many workspaces, many users | CONFIRMED |
| Q14 | Restricted access for employees/managers? | "yes" | Roles and property-scoped access (D-017) | CONFIRMED |
| Q15 | What happens with no internet? | "task stored and later retry" | Android queues writes and retries automatically | CONFIRMED |
| Q16 | Same record edited on phone and website simultaneously? | "one of them will be taken into account" | One write wins. Specified as field-level last-write-wins; money entries are never overwritten (D-020) | CONFIRMED (rule PROVISIONAL) |

### 1.2 From `idea and featuers.txt`

| Idea | Interpretation | Placement |
|---|---|---|
| Shareability among owners | Co-owners and partners get access to the properties they own | MVP (team roles) |
| Shareability between tenant and owner | Tenant sees their own dues, receipts and documents | V1 (tenant portal) |
| Notice board to broadcast to all tenants | Notices to all tenants, a property, or selected units | V1 |
| Logging rent and security with images for proof | Proof photos on payments, deposits, readings and inspections | MVP |
| Calculation of the rent | Automatic rent charges, proration, utilities, balances, settlement | MVP |
| Voice recordings (to be decided) | Deferred | Not in MVP/V1 (D-011) |
| Pay only by the owner, not by the tenant; tenant can view in app/website | Workspace owner pays; tenants never pay | CONFIRMED (D-008) |
| Pay per property, later to be increased | Per-property pricing; price rises later | Model CONFIRMED; unit of pricing needs review (D-010) |

### 1.3 Owner Q&A of 2026-09-18

| Question | Answer | Status |
|---|---|---|
| When do tenants get their own login (dues, notice board, chat)? | V1, after the landlord MVP. The MVP shares receipts, reminders and QR through WhatsApp/SMS links; the DB is tenant-ready from day one. | CONFIRMED (D-005) |
| Which stack? | Kotlin Android + Next.js (website and API) + PostgreSQL on Supabase | CONFIRMED (D-006) |
| Billing in first release? | Free beta; per-property billing on the website in V1 | CONFIRMED (D-009) |
| Voice recordings? | Not for now | CONFIRMED (D-011) |

## 2. Business

| Topic | Finding | Status |
|---|---|---|
| Primary customer | (a) Individual landlords with several properties or units who use paper, Excel, notebooks or WhatsApp today. (b) Property managers and small real-estate businesses managing units for other owners. | CONFIRMED |
| Secondary users | Co-owners and partners (MVP, read-only or full access); tenants (V1, free) | CONFIRMED |
| Likely size of a customer | Unknown. Design target: 1–2,000 units per workspace, fully usable offline (D-047). Typical early customer assumed 5–100 units. | PROVISIONAL |
| Value proposition | One place for every record; knowing who owes what without calculation; proof for disputes; the same data on phone and web; fast data entry during collection rounds. | PROVISIONAL |
| Non-goals (MVP) | Moving money, property listings/marketplace, full accounting (double-entry, tax filing), tenant screening | PROVISIONAL |

## 3. Property structure

| Question | Finding | Status |
|---|---|---|
| Hierarchy needed? | **Workspace → Property → Unit.** No separate Building or Floor entities. Units carry an optional free-text `floor/block` label for grouping ("Ground floor", "Block B"). | PROVISIONAL (D-013) |
| Why not Building/Floor entities? | They add three levels of navigation and tables, but only serve grouping. Multi-building complexes can be modelled as one property per building, or one property with block labels. | — |
| Property types | Residential building, independent house, apartment (single unit in a society), PG/hostel, commercial, mixed-use, land, other | PROVISIONAL |
| Unit types | Flat, house, room, bed, shop, office, warehouse, parking, other | PROVISIONAL |
| Mixed-use | Supported: unit type is per unit, so a building can have shops and flats | PROVISIONAL |
| Independent house | A property with exactly one unit (created automatically when type = independent house) | PROVISIONAL |

## 4. Tenant structure

| Question | Finding | Status |
|---|---|---|
| One unit, many tenants? | Yes. Co-tenants/family share **one tenancy** (one rent). For PG/hostels where each bed or room pays separately, each bed/room is its own **unit**. | CONFIRMED / model PROVISIONAL (D-014) |
| One tenant, many units? | Yes, through several tenancies (each with its own rent and ledger) | CONFIRMED |
| Historical tenancies? | Yes. Tenancies are never deleted; ended tenancies stay in unit and tenant history. | CONFIRMED |
| Tenant moves between units? | Yes. MVP: end the old tenancy, start a new one, and transfer the deposit with a linked internal transfer. V1: guided "move to another unit". | PROVISIONAL |
| Family/co-tenants/occupants? | Tenancy parties with roles: primary, co-tenant, occupant (one primary) | PROVISIONAL |

## 5. Ownership

| Question | Finding | Status |
|---|---|---|
| One landlord, many properties | Yes | CONFIRMED |
| Many owners, one property | Yes. Owners are records with ownership share % (must total 100%). | CONFIRMED / model PROVISIONAL (D-016) |
| Manager manages other people's properties | Yes. The manager's workspace holds properties of several owners. An owner can be invited as a Viewer scoped to their properties. | CONFIRMED |
| Owner statements (income split by share) | V1 | PROVISIONAL |

## 6. Payments — recorded vs collected

**Decision: A. The app only records payments made elsewhere** (cash, bank transfer, UPI, cheque, card, wallet). It never holds or moves money. This is the most important architecture decision in this document because it removes payment-gateway integration, PCI scope, payouts, KYC, and money-transmission regulation. (D-004, CONFIRMED)

The owner also wants a chat where the landlord can send a payment QR. That is a V1 feature. In the MVP, the landlord stores payment instructions (UPI ID, bank details, QR image, payment link) and shares them with a reminder through WhatsApp/SMS links.

## 7. Users and roles

| Role | Who | Access | When |
|---|---|---|---|
| Owner | Workspace creator (landlord, or manager business owner) | Everything incl. members, settings, deletion, billing | MVP |
| Admin | Partner, co-owner with full rights, office head | Everything except billing, workspace deletion, ownership transfer | MVP |
| Manager | Property manager or employee | All record keeping on assigned properties; no member management | MVP |
| Viewer | Passive co-owner, accountant, auditor | Read-only on assigned properties; reports and exports; no ID documents | MVP |
| Staff | Field collector, caretaker | Record payments, readings, expenses only | V1 |
| Tenant | Tenant of a unit | Own tenancies, dues, receipts, shared documents, notices, chat | V1 |

Status: PROVISIONAL (D-017). Custom roles are Future.

## 8. Documents

Users will store rental agreements, ID documents (Aadhaar, passport, driving licence, national ID), address proofs, police verification, payment proofs, bills and receipts, property photos, inspection photos, and payment QR images. (CONFIRMED)

Safeguards (D-025, PROVISIONAL):

- Store document **files**, but never full ID **numbers** (keep only the last 4 characters).
- ID, address-proof and police-verification files are flagged **sensitive**. Only Owner, Admin and Manager can open them, and every opening is audited.
- Private storage with short-lived signed links only.
- **[LEGAL CHECK]** Rules on keeping ID copies differ by country. For example, India's Aadhaar rules recommend masked Aadhaar copies; GDPR applies in the EU/UK. A privacy lawyer must review the privacy policy and in-app guidance before public launch.

## 9. Utilities

- Electricity, water, gas and other meters are **read manually**. Charge = (current − previous reading) × rate + fixed charge. It is proposed by the app and confirmed by the user, then added to the tenant's balance. (CONFIRMED intent; formula PROVISIONAL, D-024)
- Utilities without meters: enter the **bill amount** as a charge, with an optional bill photo.
- Opening readings at move-in and final readings at move-out feed the final settlement.
- Shared meters split between units: V1. Tariff slabs: Future.

## 10. Offline

- **Android:** fully usable offline for data already synced. Every change is saved locally, queued, and retried automatically until the server accepts or rejects it (CONFIRMED, D-018).
- **Website:** online-only (PROVISIONAL, D-019).
- **Simultaneous edits:** one write wins. For normal fields, the change that reaches the server last wins, per field. Money entries are never edited, only voided and re-entered, so two payments recorded offline on two devices are both kept (D-020).

## 11. Reports — what landlords need to see

Inferred from the master prompt and the stated problem (PROVISIONAL; confirm during beta):

1. Who has paid this month, who has not, and how much is overdue (dashboard, aging)
2. Collected vs billed per month; income per property; expenses; net cash
3. A tenant's full statement with running balance (dispute proof)
4. Deposits held (a liability they must return)
5. Vacant units, upcoming move-outs, lease expiries
6. Export of everything (CSV) for their accountant

## 12. Notifications

| Who | MVP | V1 |
|---|---|---|
| Landlord/manager | Daily push digest (due today, newly overdue, move-outs, lease expiries); in-app notification centre; emails for invites and account events | Weekly email summary; near-real-time "data changed" push |
| Tenant | None automated. The landlord sends reminders, receipts and QR through WhatsApp/SMS share links. | Push/email: rent due, receipt, notices, chat messages |

Automated WhatsApp/SMS through paid providers is Future (per-message cost, template approval). (PROVISIONAL, D-028)

## 13. Monetization

| Item | Finding | Status |
|---|---|---|
| Who pays | Workspace owner only. Tenants never pay. | CONFIRMED (D-008) |
| Pricing unit | Per property | CONFIRMED intent. Needs review: see §14.3 (D-010) |
| When | Free beta at launch; billing on the website in V1 | CONFIRMED (D-009) |
| Price points, free tier, trial | Unknown | REQUIRES DECISION before V1 |
| Where users pay | Website checkout. The Android app shows plan status without purchase buttons. | REQUIRES DECISION: verify Google Play policy (D-046) |

## 14. Where I disagree with, or refine, the stated ideas

As the master prompt requires, these points are raised rather than silently accepted.

### 14.1 "Web page is easier" vs Android-first
The idea notes say a web page is easier; the master prompt wants Android + web. Both are needed, and the web **is** faster to build because it has no offline sync. **Recommendation:** build the backend and website first, then build the Android app on top of the sync layer from its very first screen. Early beta users can use the website on their phones meanwhile. (D-050)

**Owner (2026-09-19):** agreed. Website first; beta users use it on their phones. (D-050 CONFIRMED)

### 14.2 In-app chat is expensive
Realtime chat means message storage, media uploads, push delivery, unread state, moderation and abuse reporting, which is roughly a product of its own. It was moved to V1 (owner agreed). WhatsApp share links cover the MVP need of sending a QR or a reminder.

**Owner (2026-09-19):** chat is for conversation, not documents. Images are allowed but kept to a minimum to hold down cost; no PDF/document attachments. (D-057)

### 14.3 Per-property pricing under-charges large buildings
A 60-flat building and a 1-room house would both count as "one property". Managers with big buildings, the customers who get the most value, would pay the least per unit. **Options:** (a) per property as stated; (b) per unit; (c) per property with unit bands (e.g. 1–5, 6–20, 21+ units). **Recommendation:** (c), or (b) with a free allowance. Decide before V1 billing. (D-010, REQUIRES DECISION)

**Owner (2026-09-19):** per property, with one property covering at most 50 units (a 120-unit building counts as 3). Sold in packages of 10, 50 and 100 properties. Price points still to set. (D-056, supersedes D-010)

### 14.4 Global launch with an Android-only app
iPhones hold a large share in several markets (for example the US and UK), and tenants (V1) will use every kind of phone. **Mitigation:** the website is responsive and fully functional on phones. An iOS app can come later by sharing the Kotlin data/sync code (Kotlin Multiplatform). (D-007)

**Owner (2026-09-19):** agreed; this is why the website comes first.

### 14.5 Storing Aadhaar and other ID documents
This is allowed by the owner's answer, but it is the largest privacy risk in the product. The safeguards in §8 are mandatory, not optional. **[LEGAL CHECK]**

**Owner (2026-09-19):** we are not using Aadhaar for authentication (no eKYC), so no UIDAI-style licensing applies. Users upload images; we must store them privately and never expose them via a public URL. **Note:** privacy laws (DPDP, GDPR) still cover these uploads as personal data, so a privacy policy and processor terms are still needed; no extra product features are. (D-025 CONFIRMED)

### 14.6 "One of them wins" must not apply to money
If two devices record two different payments offline, "one wins" would silently delete real money. Rule: payments, charges and other money entries are **append-only**. Both entries are kept, a possible-duplicate warning is shown, and corrections happen by voiding. (D-020, D-021)

**Owner (2026-09-19):** agreed. **Note:** it still matters on the website: two members can record the same payment from two browsers, so duplicate flags and append-only money apply from day one. (D-020 CONFIRMED)

### 14.7 Late fees and deposits are regulated differently everywhere
Caps on deposits, deposit interest, maximum late fees and refund deadlines vary by country and state. The app records what the landlord enters and does not claim legal compliance. **[LEGAL CHECK]** before advertising any "compliance" features. (D-045)

**Owner (2026-09-19):** these are set by whoever has authority in the workspace (Owner, Admin or Manager). The app does not interfere. (D-045 CONFIRMED)

## 15. Remaining decisions (after the Q&A)

### CRITICAL: affect architecture or database. Please confirm or change before development starts (milestone M0).

| ID | Decision | Default being used |
|---|---|---|
| D-012 | Currency scope | One currency per property, locked after its first tenancy |
| D-014 | Unit and co-tenant model | Beds/rooms billed separately = separate units; co-tenants share one tenancy |
| D-021 / D-022 | Financial model and rent periods | Two-account ledger with FIFO; monthly cycles; proration by days; rounding to whole currency units |
| D-030 | Hosting region | Region closest to the first 100 customers (ask: where are they?) |

### IMPORTANT: affect product design. Decide before the related milestone.

| ID | Decision | Needed by |
|---|---|---|
| D-056 | Price points for the 10/50/100 packages | V1 billing |
| D-046 | Google Play payments policy approach | V1 billing |
| D-054 | Billing provider (merchant-of-record vs Stripe/Razorpay) | V1 billing |
| D-026 | Phone-number login timing | V1 (tenants) |
| D-053 | Storage quota per workspace | M7 (documents) |
| D-003 | Languages after English | After beta |

### OPTIONAL: safe to postpone.

| ID | Decision |
|---|---|
| D-039 | Product name and branding |
| D-042 | Maintenance requests module |
| D-043 | CSV import timing |
| D-055 | Chat message retention (V1) |

## DECISION REGISTER

Full reasoning, consequences and affected documents for each row are in `16_DECISION_LOG.md`.

| ID | Decision | Status | Options | Recommended Option | Reason |
|---|---|---|---|---|---|
| D-001 | Primary customers | CONFIRMED | Landlords only; managers only; both | Both | Owner answer Q1 |
| D-002 | Launch market | CONFIRMED | India first; global | Global | Owner answer Q9 |
| D-003 | UI language at launch | PROVISIONAL | English only; English + Hindi; many | English only, all strings externalized | Smallest launch; localization later without rewrite |
| D-004 | Payments recorded vs collected | CONFIRMED | Record only; collect via gateway | Record only | Owner answer Q8; avoids gateway, KYC, PCI |
| D-005 | Tenant login, notice board, chat timing | CONFIRMED | MVP; partial MVP; V1 | V1 | Q&A 2026-09-18 |
| D-006 | Technology stack | CONFIRMED | Kotlin+Next.js+Postgres; React Native+Next.js; Supabase-only; Firebase | Kotlin + Next.js + PostgreSQL (Supabase) | Q&A 2026-09-18; matches owner skills |
| D-007 | iOS app | PROVISIONAL | Native iOS now; cross-platform; web for iPhone | Web for iPhone users; iOS later via KMP | Follows D-006 |
| D-008 | Who pays | CONFIRMED | Owner; tenant; both | Owner only; tenants free | Idea notes |
| D-009 | Billing timing | CONFIRMED | At launch; free beta then V1 | Free beta, billing V1 | Q&A 2026-09-18 |
| D-010 | Pricing unit and price | SUPERSEDED by D-056 | Per property; per unit; property + unit bands | Property + unit bands | See §14.3 |
| D-011 | Voice recordings | CONFIRMED | MVP; chat only; later | Later | Q&A 2026-09-18 |
| D-012 | Currency scope | PROVISIONAL | Per workspace; per property; per tenancy | Per property | Supports owners in several countries without per-record complexity |
| D-013 | Property hierarchy | PROVISIONAL | Property→Building→Floor→Unit; Property→Unit + labels | Property→Unit + labels | Fewer levels; labels give grouping |
| D-014 | Unit and co-tenant model | PROVISIONAL | Multiple tenancies per unit; one tenancy per unit with co-tenants | One tenancy per unit; beds as units | Clear definition: a unit is what is rented for one rent |
| D-015 | Tenant ↔ tenancies | CONFIRMED | One; many | Many (concurrent + history) | Owner answer Q5 |
| D-016 | Owner model | PROVISIONAL | Owners = users; owners = records | Records with shares, optional Viewer login | Owners often never log in |
| D-017 | Roles | PROVISIONAL | Fixed roles; custom roles | Owner/Admin/Manager/Viewer (MVP) + Staff/Tenant (V1) | Covers stated needs; custom roles later |
| D-018 | Android offline | CONFIRMED | Online only; read-only offline; full offline with queue | Full offline with queue and retry | Owner answer Q15 |
| D-019 | Website offline | PROVISIONAL | Online only; offline PWA | Online only | Web offline adds a second sync client for little value |
| D-020 | Conflict rule | CONFIRMED | Record LWW; field LWW; manual merge | Field LWW by server arrival; money append-only | Owner answer Q16 + money safety |
| D-021 | Financial model | PROVISIONAL | Paid/unpaid flags; per-charge allocations; ledger + FIFO | Two-account ledger + derived FIFO | Deterministic, offline-safe, auditable |
| D-022 | Rent periods and proration | PROVISIONAL | Calendar only; anniversary only; cycle day 1–28 | Cycle day 1–28 + grace; proration by days | Covers both common practices |
| D-023 | Rent charge generation | PROVISIONAL | On device; on server; both | Server hourly job, idempotent | One generator = no duplicates |
| D-024 | Utility calculation | PROVISIONAL | Bill amount only; readings × rate; tariff slabs | Readings × rate + fixed, or bill amount | Owner answer Q10; slabs later |
| D-025 | Sensitive documents | CONFIRMED | Store all; store files not numbers; don't store | Files yes, numbers no (last 4) | Owner answer Q11 + data minimization |
| D-026 | Sign-in methods | PROVISIONAL | Email+password; Google; email code; phone OTP | Google + email code (MVP); phone OTP (V1) | No password handling; SMS costs deferred |
| D-027 | Receipt numbering | PROVISIONAL | Per device; server sequence; UUID code | Server sequence on acceptance | Sequential, gap-free per workspace |
| D-028 | Notification channels (MVP) | PROVISIONAL | Push; email; SMS; WhatsApp API | Push + in-app + transactional email; manual share links to tenants | No per-message cost |
| D-029 | Late fees | PROVISIONAL | Manual; automatic | Manual MVP, automatic V1 | Deterministic rule is subtle with offline payments |
| D-030 | Hosting region | REQUIRES DECISION | Mumbai; Singapore; Frankfurt; US | Closest to first customers | Latency + data-protection law |
| D-031 | Android UI toolkit | PROVISIONAL | XML Views; Jetpack Compose | Compose, minSdk 26 | Current Android standard; java.time native |
| D-032 | Web UI | PROVISIONAL | Various | Next.js App Router + Tailwind + shadcn/ui | Owner knows Next.js |
| D-033 | Data access and DB exposure | PROVISIONAL | Supabase client + RLS; server ORM | Drizzle ORM on server; tables in non-exposed schema; RLS deny-all | One enforcement point (API) + defence in depth |
| D-034 | Record IDs | PROVISIONAL | Server serials; client UUIDs | Client-generated UUID v4 | Offline creation without collisions |
| D-035 | Sync protocol | PROVISIONAL | Timestamp pull; CRDT; version cursor + op queue | Per-workspace version cursor + idempotent ops | Simple, correct ordering, no clock trust |
| D-036 | Exports | PROVISIONAL | CSV; XLSX; PDF; ZIP | CSV ZIP (MVP) + PDFs for receipts, statements, settlement | Accountant-friendly, simple |
| D-037 | Account/workspace deletion | PROVISIONAL | Immediate; grace period | 30-day grace then purge | Recovery from mistakes; store policies |
| D-038 | Android local data protection | PROVISIONAL | SQLCipher; OS encryption + app lock | OS file encryption + private storage + optional biometric lock | No extra crypto dependency |
| D-039 | Product name | REQUIRES DECISION | — | — | Owner's choice |
| D-040 | Proration handling | PROVISIONAL | Settings flags; proposal + edit | App proposes, user edits before confirm | No config flags; handles local customs |
| D-041 | Onboarding existing tenancies | PROVISIONAL | Back-generate history; opening balances | Billing start date + opening balances | Landlords digitize mid-tenancy |
| D-042 | Maintenance requests | PROVISIONAL | MVP; V1; Future | Future; repairs as expenses | Chat covers requests in V1 |
| D-043 | CSV import | PROVISIONAL | MVP; V1 | V1 | Bulk unit creation covers most MVP setup |
| D-044 | Time zone scope | PROVISIONAL | Per workspace; per property | Per workspace | Dates only; at most one day difference |
| D-045 | Jurisdiction rules (deposit caps, interest, late-fee limits) | CONFIRMED | Encode per country; record only | Record only + legal check | Cannot maintain legal rules for every region |
| D-046 | Google Play billing approach | REQUIRES DECISION | Play Billing in app; web-only purchase | Web-only purchase (verify policy) | Avoid store fees if permitted |
| D-047 | Scale target | PROVISIONAL | — | ≤ 2,000 units per workspace fully synced offline | Covers target customers |
| D-048 | Backups | PROVISIONAL | Provider only; provider + off-site | Supabase daily + weekly off-site dump + storage mirror | Provider-independent recovery |
| D-049 | Rate limiting | PROVISIONAL | App-level; platform-level | Supabase Auth limits + Vercel firewall for MVP | No extra service until abuse appears |
| D-050 | Build order | CONFIRMED | Android first; web first; parallel | Backend + web first, Android on sync layer | Domain validated online first |
| D-051 | Rent frequency | PROVISIONAL | Monthly; weekly/quarterly/yearly | Monthly only in MVP | Covers the stated market; others later |
| D-052 | Recurring fixed charges | PROVISIONAL | Manual each month; recurring definitions | Recurring monthly charges per tenancy (MVP) | Maintenance/parking fees are common |
| D-053 | Storage quota | PROVISIONAL | Unlimited; fixed quota | 1 GB per workspace in beta | Cost control |
| D-054 | V1 billing provider | REQUIRES DECISION | Merchant of record (Paddle/Lemon Squeezy); Stripe; Razorpay | Merchant of record | Handles global sales tax/VAT |
| D-055 | Chat retention (V1) | REQUIRES DECISION | Forever; tenancy + N years | Tenancy lifetime + 1 year (proposal) | Privacy + dispute evidence |
| D-056 | Pricing unit and packages | CONFIRMED (prices open) | Per property; per unit; unit bands; unit cap | Property = up to 50 units; packages 10/50/100 | Owner 2026-09-19 |
| D-057 | Chat scope (V1) | CONFIRMED | Text+photos+PDF; text+photos; text | Text; few compressed images; no documents | Cost |
| D-058 | Local dev database until region chosen | PROVISIONAL | Wait for Supabase; local Postgres; PGlite | PGlite + one local user; same schema | Build now, move later |

## Next step

The four critical questions were answered on 2026-09-18. The documents 01–19 are written using the defaults above. Items marked PROVISIONAL can be changed before development. Changing them updates the affected documents listed in `16_DECISION_LOG.md`.
