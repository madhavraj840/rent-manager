# Rent Manager (working title): Product Documentation

The single source of truth for building the **Android app + website + backend + database + sync** of the landlord rent-management platform. Created 2026-09-18 from `TO DO LIST.txt` (master prompt + answers), `rent application/idea and featuers.txt` and the owner Q&A. The older `Desktop/rent_app/` notes are **superseded**; they were used for ideas only.

## Documents (read in this order)

| # | Document | Answers |
|---|---|---|
| 00 | [Product Discovery](00_PRODUCT_DISCOVERY.md) | What we know, what's decided, Decision Register |
| 01 | [PRD](01_PRD.md) | What we build and why; requirement IDs; permissions; business rules |
| 02 | [Feature Specification](02_FEATURE_SPECIFICATION.md) | What every feature does (13 attributes each) |
| 03 | [User Flows](03_USER_FLOWS.md) | What happens step by step, with edge cases |
| 04 | [Domain Model](04_DOMAIN_MODEL.md) | Real-world concepts, lifecycles, invariants |
| 05 | [Database Design](05_DATABASE_DESIGN.md) | Tables, constraints, ER diagram |
| 06 | [System Architecture](06_SYSTEM_ARCHITECTURE.md) | Stack, components, jobs, backups, cost |
| 07 | [API Specification](07_API_SPECIFICATION.md) | Every endpoint and error code |
| 08 | [Sync Specification](08_SYNC_SPECIFICATION.md) | Offline, queue, conflicts, worked examples |
| 09 | [UI/UX Specification](09_UI_UX_SPECIFICATION.md) | Design system and every screen |
| 10 | [Financial Rules](10_FINANCIAL_RULES.md) | Every calculation, with numbers |
| 11 | [Security & Privacy](11_SECURITY_AND_PRIVACY.md) | Data protection, auth, legal checks |
| 12 | [Notifications](12_NOTIFICATION_SPECIFICATION.md) | Every notification and message template |
| 13 | [Reports](13_REPORTING_SPECIFICATION.md) | Dashboard metrics and reports |
| 14 | [Testing Strategy](14_TESTING_STRATEGY.md) | Test catalogue and CI gates |
| 15 | [Development Roadmap](15_DEVELOPMENT_ROADMAP.md) | Milestones M0–M8, V1 |
| 16 | [Decision Log](16_DECISION_LOG.md) | Why each decision was made |
| 17 | [Traceability](17_REQUIREMENT_TRACEABILITY.md) | Requirement → … → test |
| 18 | [Edge Cases](18_EDGE_CASES.md) | Unusual situations and expected behaviour |
| 19 | [Architecture Review](19_ARCHITECTURE_REVIEW.md) | Consistency check and **critical issues before development** |

All documents are version 0.1, status Draft, awaiting owner review.

## Key decisions at a glance

- **Landlord MVP first** (landlords, managers, co-owners). Tenant login, notice board and chat come in V1.
- **Stack:** Android (Kotlin, Compose, Room, WorkManager) + Next.js (website + REST API) + PostgreSQL/Auth/Storage on Supabase.
- **Payments are recorded, never collected.** Reminders and payment QR go through the landlord's WhatsApp/SMS.
- **Offline-first Android:** every change is queued and retried. The website is online-only.
- **Money model:** append-only ledger per tenancy (RENT and DEPOSIT accounts). Payments clear the oldest dues first; balances are derived, never stored.
- **Conflicts:** field-level "later arrival wins"; money is never overwritten; rule violations are shown to the user.
- **Global:** currency per property, locale formatting. English first.
- **Free beta;** per-property billing on the website in V1. No voice notes for now.

## Before development starts

Resolve the seven items in [19 §4](19_ARCHITECTURE_REVIEW.md#4-critical-issues-before-development). The most important are confirming the money model (D-021, D-022), the unit and currency model (D-014, D-012), the conflict rule (D-020), and choosing the hosting region (D-030).

## Rules for AI coding agents implementing this

1. Build only what is marked **MVP** in `01_PRD.md` §9, in the milestone order of `15_DEVELOPMENT_ROADMAP.md`. V1/Future items get no code, stubs or flags. The only exceptions are schema fields the documents explicitly reserve.
2. When documents disagree, precedence is: `16` (latest decision) > `10` (money) > `04` (domain) > `05` (schema) > `08` (sync) > `07` (API) > `02` (features) > `03` (flows) > `09` (UI) > `01`. Then log the conflict in `16` and fix the losing document.
3. Every money calculation must pass `spec/financial-vectors.json` (10 §19) in Kotlin, TypeScript and SQL.
4. Every write goes through a server command (06 §6): authorization, validation, version stamping, audit.
5. Do not invent features, entities, screens or settings. Missing detail → choose the simplest option consistent with these documents and record it in `16`.
6. Use requirement IDs in commit messages and PR descriptions (e.g. `PAY-001`).
