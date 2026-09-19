# 19 — Architecture Review

```text
Version:      0.1
Status:       Draft — review of documents 00–18 (v0.1) on 2026-09-18
Last Updated: 2026-09-18
Depends On:   00–18
Affected By:  owner decisions on the critical issues below
```

## 1. Summary

The documentation set is consistent enough to start development **after the owner confirms five PROVISIONAL decisions** that shape the database and the money model (§4, items 1–3), and after the hosting region is chosen. The review found 12 inconsistencies or gaps. All were **fixed during this review** and are listed in §2 so the change is traceable. The main remaining risks are the offline-sync milestone (M4), legal preparation for ID documents, and one developer's capacity for a ~24-week MVP.

## 2. Issues found and fixed during the review

| # | Finding | Documents | Fix applied |
|---|---|---|---|
| R-1 | "Reminder noted" had no endpoint or sync op, although the UI and traceability relied on it | 07, 08, 17 | Added `POST {ws}/tenancies/{id}/reminders` and op `tenancy.reminder_noted`; tenancy summary gained `last_reminder_at/by` |
| R-2 | Users could not dismiss a "possible duplicate" flag (08 §8 promised it) | 07, 08, 17 | Added `POST {ws}/ledger-entries/{id}/dismiss-duplicate` and op `ledger.dismiss_duplicate` |
| R-3 | Tenancy Activity tab shown to all roles, but the audit log is Owner/Admin only (01 §12) | 09 | Activity tab restricted to Owner/Admin (online only on Android); other roles see "Last reminder" in the header |
| R-4 | Managers could change property payment instructions through `PATCH property`, contradicting 01 §12 | 07 | That field now requires Owner/Admin |
| R-5 | Expense visibility rule in 07 ("O, A, V(all)") differed from 13 §1 (all-properties members) | 07 | Aligned with 13 §1 |
| R-6 | Workspace settings were neither an offline op nor listed as online-only on Android | 08 | Listed as online-only |
| R-7 | Wizard and readings-round drafts had no defined local storage | 08 | Added local `drafts` table (08 §4.2) |
| R-8 | Dependency cycle: 05 listed 10 as a dependency and 10 listed 05 | 05, 10 | 10 is the authority for calculations; 05 "implements" it; headers corrected |
| R-9 | No requirement to record acceptance of terms/privacy policy (legal need, store policy) | 01, 05, 14, 17 | Added ACC-008 (`profiles.terms_version`, `terms_accepted_at`), covered by ACC-TEST-001 |
| R-10 | A signed upload URL could store files larger or of another type before `complete` ran | 11 | Bucket-level 10 MB limit and MIME allow-list; no storage policies for client roles |
| R-11 | Invite token lifecycle unclear (reuse) | 11 | Token hashed, single-use, 7-day expiry, bound to email |
| R-12 | Five MVP requirements had no dedicated test (ACC-007, TENANT-004, PAY-008/009, REP-002, SRCH-001) plus TENANCY-005 | 14, 17 | Added ACC-TEST-004, UI-TEST-009, REP-TEST-009, API-TEST-007; extended TNCY-TEST-003 |

Also corrected while writing: deposit double-recording is now **rejected** (`DEPOSIT_EXCEEDS_DUE`) instead of warned (02, 07, 10). Tombstone purge with `purge_floor` and `RESYNC_REQUIRED` was added so that devices offline for more than 90 days cannot keep deleted rows (05, 06, 07, 08).

## 3. Review questions

### 3.1 Does the database support every feature?
**Yes.** Every MVP feature card (02) maps to tables in 05 (see 17 §2). Version 1 needs are reserved: tenant links, notices, chat, claims and subscription tables are designed; `documents.visible_to_tenant`, `workspaces.plan`, role STAFF and `tenancies.late_fee_rule` already exist.
Accepted redundancy: `tenancies.deposit_agreed_minor` holds the initial agreed amount only. The current agreed figure is derived from the ledger (13 §6). Keep it, or drop it at M1. The UI must never use it after the tenancy starts.

### 3.2 Does the API support every UI action?
**Yes, after R-1/R-2.** Every screen action in 09 maps to an endpoint in 07 or is client-only (share intents, local search on Android). Web mutations use the same REST endpoints as Android sync ops (06 §6).

### 3.3 Does synchronization support every data type?
**Yes.** All [S] tables are pulled with scope rules (08 §2). Every offline-capable action has an op type (08 §6.3); online-only actions are listed (08 §2, updated by R-6). Files are handled separately (08 §12). Audit events are deliberately not synced.

### 3.4 Are financial calculations consistent?
**Yes.** Checked across 03, 05, 07, 10, 13 and 14:
- FIFO order (due date → category rank → id) is identical in 10 §3.2 and the SQL view 05 §6.1.
- Worked numbers agree everywhere: proration ₹6,500 / ₹9,194; utility ₹2,085; settlement refund ₹19,554 (10 §10.2 ↔ 07 §4.5 ↔ 14 SETTLE-TEST-001).
- Collected, net cash and deposit exclusions agree (10 §13 ↔ 13 §2).
- Receipt rules agree (BR-018 ↔ 07 §4.3 ↔ 10 §13).
- **Remaining risk:** two implementations (Kotlin on Android, SQL/TypeScript on the server). Mitigated by the shared vectors gate (14 §5).

### 3.5 Are permissions consistent?
**Yes, after R-3/R-4/R-5.** 01 §12 is the single matrix; 07 roles, 08 scope rules, 09 visibility and 11 §4 all reference it. PERM-TEST-001 is table-driven from the same matrix.

### 3.6 Are user flows consistent?
**Yes.** The 28 flows (03) use the same states (04 §5), rules (10) and error codes (07 §1.6). A script verified that every screen ID used in any document is defined in 09 and every error code is defined in 07.

### 3.7 Are there circular dependencies?
- **Documents:** one cycle (05 ↔ 10), resolved by R-8.
- **Code:** none designed. Route handlers and the sync dispatcher both call commands, and commands never call either. On Android, repositories write to Room and the outbox, and the sync engine reads the outbox and writes Room; UI → repository → sync is one-directional.
- **Runtime:** charge generation and tenancy start could race. Resolved by the atomic `tenancy.start` op and unique generated keys (08 §6.2).

### 3.8 Are there unnecessary features?
Nothing is speculative; every MVP item traces to the brief, the owner's answers or legal needs. However, the MVP is large for one developer. **Cut candidates** if M4 or M5 overrun, in order of least user impact:

| Candidate | Saving | Fallback |
|---|---|---|
| RENT-007 rent schedule preview | ~2 days | Ledger shows actual charges only |
| TEAM-006 audit log **viewer** (audit is still recorded) | ~3 days | Support can query on request; ship in V1 |
| DOC-005 restore UI ("Recently deleted") | ~2 days | Soft delete stays; restore by support within 30 days |
| SET-001 rounding toggle | ~1 day | Always whole units |
| OWN-001 owners and shares | ~3 days | Move to V1 with owner statements |

### 3.9 Are there missing requirements?
Added during review: ACC-008 (terms acceptance). Minor, not blocking:
- A support/feedback channel. SCR-90 has "Help & feedback"; define it as a mailto + WhatsApp support link (no requirement ID needed).
- Tenant consent for storing ID copies is the landlord's legal duty. The app shows guidance (11 §15); a consent checkbox on ID upload could be added after legal review.
- Data import (CSV) is V1 by decision D-043.

### 3.10 Are there scalability problems?
None at MVP targets. Watch items:

| Item | Risk | Trigger to act | Action |
|---|---|---|---|
| Hourly rent job scans all ACTIVE tenancies | Grows linearly (1,000 × 200 = 200k checks/hour, mostly no-ops) | Job > 60 s | Add `next_generation_date` column + index; process only due tenancies |
| Per-workspace write serialization | Latency at first-of-month peaks in large workspaces | p95 write > 800 ms | Shorter transactions; batch job inserts per tenancy (already) |
| Dashboard FIFO over all tenancies | Window function over ~100k rows | p95 > 2 s (PERF-TEST-002) | `tenancy_balances` cache (06 §15) |
| Android database size for 10-year histories | ~300k rows on low-end phones | Initial sync > 60 s or DB > 150 MB | Stop syncing CLOSED tenancies older than 2 years (fetch on demand) |
| Serverless time limits for full export and large PDFs | Timeouts on very large workspaces | Any timeout in logs | Move to a small background worker (06 §15) |

### 3.11 Are there security problems?
No known design flaws after R-10/R-11. Accepted MVP limitations:
- No MFA for Owners (V1 TOTP).
- API rate limiting relies on platform rules (D-049).
- No malware scanning of uploads (files are served only within the workspace; revisit for V1 tenant sharing and chat).
- Unsynced changes on a lost phone are lost (EC-097).

An external security review before public launch is recommended (11 §19).

### 3.12 Are there assumptions that were never confirmed?

| Assumption / decision | Status | Impact if wrong |
|---|---|---|
| D-021 FIFO: payments cannot be directed to a specific month | PROVISIONAL | UX expectation "mark July paid" may clash; changing to explicit allocation later is a large change → **confirm now** |
| D-022 cycle day 1–28, grace days, proration by actual days, whole-unit rounding | PROVISIONAL | Changes charge generation and every vector → **confirm now** |
| D-014 beds/rooms billed separately are units | PROVISIONAL | Schema change if multi-tenancy per unit is required → **confirm now** |
| D-012 currency per property | PROVISIONAL | Schema change if per-tenancy currency is needed → **confirm now** |
| D-020 later arrival wins for the same field | PROVISIONAL | Would need per-field versions + merge UI → **confirm now** |
| D-023 server-only rent generation (offline phones see new charges after sync) | PROVISIONAL | Would need deterministic on-device generation |
| D-027 receipts only after sync | PROVISIONAL | Would need per-device numbering |
| D-044 time zone per workspace | PROVISIONAL | Minor date shifts |
| D-047 ≤ 2,000 units per workspace offline | PROVISIONAL | Partial sync needed sooner |
| A-01…A-10 (01 §16) | Assumptions | Validated in beta |
| Success metric targets (01 §14) | Proposed | Owner to set |
| Vendor limits and prices (06 §14) | From memory, approximate | Verify at M0 |
| Store policies (account deletion, data safety, billing) | To verify | Could block release |
| Legal positions (11 §15) | **[LEGAL CHECK]** | Could require product changes (e.g. ID storage) |

## 4. CRITICAL ISSUES BEFORE DEVELOPMENT

Resolve these in milestone **M0**, before the schema (M1) is written:

1. **Confirm the money model (D-021, D-022).** Walk through `10_FINANCIAL_RULES.md` §3–§10 with real examples from your own properties. Pay special attention to FIFO: a payment always clears the oldest dues first and cannot be pinned to a chosen month. Also confirm the cycle-day/grace/proration defaults and whole-unit rounding.
2. **Confirm the unit and currency model (D-014, D-012).** Separately billed beds/rooms become units; co-tenants share one tenancy; one currency per property.
3. **Confirm the conflict rule detail (D-020):** field-level, later arrival at the server wins; money is never overwritten.
4. **Choose the hosting region (D-030).** Needed to create the Supabase and Vercel projects; it affects latency and data-protection transfers.
5. **Verify platform assumptions** (one day of checks): Vercel Pro cron frequency and function duration limits; Supabase JWKS signing keys, signed upload URLs, bucket file-size/MIME limits, `btree_gist` availability and plan limits; Google Play requirements for account deletion, the data safety form, and (for V1) subscription billing.
6. **Plan the legal work.** Privacy policy, terms (ACC-008 needs a version to accept), processor terms for business customers, and ID-document guidance for each launch country **[LEGAL CHECK]**. Start by M6; this must be done before real tenant data is stored by external beta users (M8).
7. **Agree the scope against capacity.** The MVP is about 24 weeks for one full-time developer (15 §3). Decide now which cut candidates (§3.8) to drop if the sync milestone overruns.

**Before V1 (not blocking the MVP):** pricing unit and price points (D-010), Play billing approach (D-046), billing provider (D-054), chat retention (D-055), SMS provider and cost for phone login (D-026).
