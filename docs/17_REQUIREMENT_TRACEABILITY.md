# 17 — Requirement Traceability

```text
Version:      0.1
Status:       Draft — awaiting owner review
Last Updated: 2026-09-18
Depends On:   01 (requirements), 02 (features), 03 (flows), 04 (entities), 05 (tables), 07 (API), 09 (screens), 14 (tests)
Affected By:  any change to those documents
```

## 1. How to read and maintain this

Each row follows the chain **Requirement → Feature → User flow → Domain entity → Database → API → UI → Test**. Example:

```text
PAY-001 Record a payment
   ↓ F-PAY-1 Record a payment                         (02 §9)
   ↓ FL-09 Record payment                             (03)
   ↓ LedgerEntry (kind PAYMENT)                       (04 §4.11)
   ↓ app.ledger_entries                               (05 §2.15)
   ↓ POST {ws}/tenancies/{id}/payments · op ledger.payment   (07 §3.7, 08 §6.3)
   ↓ SCR-43 Record payment                            (09)
   ↓ PAY-TEST-001, UI-TEST-001, SYNC-TEST-001         (14)
```

**When a requirement changes:** find its row, then review every artefact to its right. **When an artefact changes** (e.g. a table), use the reverse index (§4) to find affected requirements. Every MVP requirement must have at least one test. CI gate 14 §5 relies on this table staying complete.

Abbreviations: `{ws}` = `/api/v1/workspaces/{ws}`; "op" = sync push operation type (08 §6.3).

## 2. MVP matrix

### 2.1 Account, team, owners

| Req | Feature | Flow | Entity | Tables | API | Screens | Tests |
|---|---|---|---|---|---|---|---|
| ACC-001 | F-ACC-1 | FL-01 | User | profiles | Supabase Auth; `GET /me` | SCR-01 | ACC-TEST-001 |
| ACC-002 | F-ACC-1 | FL-01 | User | profiles | Supabase Auth | SCR-01, SCR-02 | ACC-TEST-001, UI-TEST-006 |
| ACC-003 | F-ACC-2 | — | User | device_tokens | `POST /me/sign-out-all` | SCR-96 | ACC-TEST-002, SYNC-TEST-012 |
| ACC-004 | F-ACC-2 | — | User | profiles | `GET/PATCH /me` | SCR-96 | ACC-TEST-001, API-TEST-005 |
| ACC-005 | F-ACC-4 | FL-25 | User, Workspace | profiles, memberships, workspaces | `POST /me/delete`, `/me/delete/cancel` | SCR-97 | ACC-TEST-003, SEC-TEST-009 |
| ACC-007 | F-ACC-3 | — | — | (device only) | — | SCR-96 | ACC-TEST-004 |
| ACC-008 | F-ACC-1 | FL-01 | User | profiles (terms_version, terms_accepted_at) | `PATCH /me` (accept terms) | SCR-01 | ACC-TEST-001 |
| TEAM-001 | F-TEAM-1 | FL-01 | Workspace, Member | workspaces, workspace_counters, memberships | `POST /workspaces` | SCR-03 | UI-TEST-006 |
| TEAM-002 | F-TEAM-1 | — | Member | memberships | `GET /me` | SCR-05 | TEAM-TEST-001 |
| TEAM-003 | F-TEAM-2 | FL-26 | Member | memberships | `POST {ws}/invites`, `POST /invites/accept` | SCR-93, SCR-94, SCR-04 | TEAM-TEST-001, SEC-TEST-008 |
| TEAM-004 | F-TEAM-2 | FL-26 | Member | membership_properties | `PATCH {ws}/members/{id}` | SCR-94 | PERM-TEST-002, SYNC-TEST-010 |
| TEAM-005 | F-TEAM-3 | FL-26 | Member | memberships | `PATCH/DELETE {ws}/members/{id}` | SCR-93 | TEAM-TEST-002, SYNC-TEST-011 |
| TEAM-006 | F-TEAM-4 | — | Audit event | audit_events | `GET {ws}/audit-events` | SCR-99 | TEAM-TEST-004 |
| TEAM-007 | F-TEAM-3 | FL-25 | Member | memberships | `POST {ws}/transfer-ownership` | SCR-91 | TEAM-TEST-003, PERM-TEST-004 |
| OWN-001 | F-PROP-2 | FL-02 | Owner, Ownership | owners, property_owners | `{ws}/owners`, `PUT {ws}/properties/{id}/owners` | SCR-23 | PROP-TEST-002 |

### 2.2 Properties, units, tenants

| Req | Feature | Flow | Entity | Tables | API | Screens | Tests |
|---|---|---|---|---|---|---|---|
| PROP-001 | F-PROP-1 | FL-02 | Property | properties, units | `POST {ws}/properties` · op property.create | SCR-22 | PROP-TEST-001 |
| PROP-002 | F-PROP-1 | FL-02 | Property | properties | `PATCH {ws}/properties/{id}` | SCR-22 | PROP-TEST-001 |
| PROP-003 | F-PROP-3 | FL-23 | Property | properties, units | `…/archive`, `…/unarchive` | SCR-21 | PROP-TEST-003 |
| PROP-004 | F-PROP-3 | FL-23 | Property | properties | `DELETE {ws}/properties/{id}` | SCR-21 | PROP-TEST-003 |
| PROP-005 | F-PROP-4 | — | Property | properties, units, tenancies, ledger_entries | `GET {ws}/properties` | SCR-20 | API-TEST-003, REP-TEST-001 |
| UNIT-001 | F-UNIT-1 | FL-03 | Unit | units | `POST …/units`, `…/units/bulk` · op unit.bulk_create | SCR-24 | UNIT-TEST-001 |
| UNIT-002 | F-UNIT-1 | FL-03 | Unit | units | `POST/PATCH units` | SCR-26 | UNIT-TEST-001 |
| UNIT-003 | F-UNIT-2 | FL-20 | Unit, Tenancy | units, tenancies | `GET …/units` | SCR-21, SCR-25 | TNCY-TEST-002, REP-TEST-007 |
| UNIT-004 | F-UNIT-3 | — | Unit | units | `…/archive`, `DELETE {ws}/units/{id}` | SCR-25 | PROP-TEST-003 |
| UNIT-005 | F-UNIT-2 | FL-20, FL-21 | Unit, Tenancy | tenancies | `GET {ws}/units/{id}` | SCR-25 | REP-TEST-007 |
| TENANT-001 | F-TEN-1 | FL-04 | Tenant | tenants | `POST {ws}/tenants` · op tenant.create | SCR-32 | TENANT-TEST-001 |
| TENANT-002 | F-TEN-1 | FL-04 | Tenant | tenants, tenancy_parties | `PATCH {ws}/tenants/{id}` | SCR-32 | TENANT-TEST-001, SYNC-TEST-004 |
| TENANT-003 | F-TEN-2 | — | Tenant | tenants | `GET {ws}/tenants` | SCR-30 | API-TEST-003, PERM-TEST-002 |
| TENANT-004 | F-TEN-2 | — | Tenant | tenants, tenancies | `GET {ws}/tenants/{id}` | SCR-31 | UI-TEST-009 |
| TENANT-005 | F-TEN-1 | FL-04 | Tenant | tenants | `GET {ws}/tenants/duplicates` | SCR-32 | TENANT-TEST-001 |
| TENANT-006 | F-TEN-3 | — | Tenant | tenants | `…/archive`, `DELETE` | SCR-31 | TENANT-TEST-001 |

### 2.3 Tenancies, rent, payments, deposits

| Req | Feature | Flow | Entity | Tables | API | Screens | Tests |
|---|---|---|---|---|---|---|---|
| TENANCY-001 | F-TNCY-1 | FL-05, FL-06 | Tenancy, Party, RentRevision, RecurringCharge, LedgerEntry, Inspection, MeterReading | tenancies, tenancy_parties, rent_revisions, recurring_charges, ledger_entries, inspections, meter_readings | `POST {ws}/tenancies` (+ `/preview`) · op tenancy.start | SCR-40 | TNCY-TEST-001, UI-TEST-002, FIN-TEST-008 |
| TENANCY-002 | F-TNCY-2 | FL-07 | as above + opening entries | as above | `POST {ws}/tenancies` (mode EXISTING) | SCR-41 | TNCY-TEST-004, FIN-TEST-017 |
| TENANCY-003 | F-TNCY-1 | FL-05, FL-21 | Tenancy | tenancies (exclusion constraint) | `POST {ws}/tenancies`, `…/notice` | SCR-40, SCR-49 | TNCY-TEST-002, DB-TEST-002, SYNC-TEST-006 |
| TENANCY-004 | F-TNCY-3 | FL-05 | Tenancy party | tenancy_parties | `POST/PATCH …/parties` | SCR-42 | TNCY-TEST-003 |
| TENANCY-005 | F-TNCY-1 | FL-05 | Tenant, Tenancy | tenancy_parties | `POST {ws}/tenancies` | SCR-31, SCR-40 | TNCY-TEST-003 |
| TENANCY-006 | F-TNCY-4 | FL-13 | RentRevision, LedgerEntry | rent_revisions, ledger_entries | `POST …/rent-revisions` (+ `/preview`) · op tenancy.revise_rent | SCR-48 | TNCY-TEST-006, FIN-TEST-013 |
| TENANCY-007 | F-TNCY-5 | — | Tenancy | tenancies | `PATCH {ws}/tenancies/{id}` | SCR-42 | NOTIF-TEST-003, REP-TEST-007 |
| TENANCY-008 | F-TNCY-6 | — | Tenancy, LedgerEntry | tenancies, ledger_entries | `POST …/cancel` | SCR-42 | TNCY-TEST-005, PERM-TEST-005 |
| TENANCY-009 | F-TNCY-7 | FL-09…FL-19 | Tenancy (aggregate) | all tenancy tables | `GET …/tenancies/{id}`, `…/ledger` | SCR-42 | UI-TEST-007, REP-TEST-004 |
| RENT-001 | F-RENT-1 | FL-08 | LedgerEntry | ledger_entries (generated_key) | cron `generate-charges` | SCR-42 | RENT-TEST-001…006, DB-TEST-003 |
| RENT-002 | F-MIN-3, F-MOUT-3 | FL-05, FL-19 | LedgerEntry | ledger_entries | `POST …/tenancies/preview`, settlement endpoints | SCR-40, SCR-51 | FIN-TEST-008…011 |
| RENT-003 | F-RENT-2 | FL-14 | LedgerEntry | ledger_entries | `POST …/charges` · op ledger.charge | SCR-44 | FIN-TEST-007, API-TEST-001 |
| RENT-004 | F-RENT-4 | FL-17 | LedgerEntry | ledger_entries (guard trigger) | `POST {ws}/ledger-entries/{id}/void`, `PATCH` (note) | SCR-47 | DB-TEST-005, FIN-TEST-006 |
| RENT-005 | F-RENT-5 | FL-10 | LedgerEntry | v_charge_allocation | `GET …/ledger` | SCR-42, SCR-10 | FIN-TEST-001…007 |
| RENT-006 | F-RENT-3 | FL-17, FL-19 | LedgerEntry | ledger_entries | `POST …/credits` · op ledger.credit | SCR-45 | FIN-TEST-018, SETTLE-TEST-002 |
| RENT-007 | F-RENT-5 | — | RentRevision, RecurringCharge | rent_revisions, recurring_charges | `GET …/schedule` | SCR-42 | FIN-TEST-023 |
| RENT-009 | F-RENT-1 | FL-08 | RecurringCharge, LedgerEntry | recurring_charges, ledger_entries | `POST …/recurring-charges`, `PATCH {ws}/recurring-charges/{id}` | SCR-40, SCR-42 | FIN-TEST-014, RENT-TEST-005 |
| PAY-001 | F-PAY-1 | FL-09 | LedgerEntry | ledger_entries | `POST …/payments` · op ledger.payment | SCR-43 | PAY-TEST-001, UI-TEST-001, SYNC-TEST-001 |
| PAY-002 | F-PAY-1 | FL-11 | LedgerEntry | v_charge_allocation | `GET …/ledger` | SCR-42 | FIN-TEST-003, FIN-TEST-004 |
| PAY-003 | F-PAY-1 | FL-10 | LedgerEntry | ledger_entries | `POST …/payments` | SCR-43 | FIN-TEST-002 |
| PAY-004 | F-PAY-2 | FL-17 | LedgerEntry | ledger_entries | `POST {ws}/ledger-entries/{id}/void` · op ledger.void | SCR-47 | PAY-TEST-002, FIN-TEST-005, SYNC-TEST-015 |
| PAY-005 | F-PAY-3 | FL-09 | LedgerEntry, Workspace | ledger_entries, workspace_counters | `GET {ws}/payments/{id}/receipt` | SCR-52 | PAY-TEST-001, PAY-TEST-002 |
| PAY-006 | F-PAY-1 | FL-09, FL-27 | LedgerEntry | ledger_entries (possible_duplicate_of) | `POST …/payments`, push, `POST {ws}/ledger-entries/{id}/dismiss-duplicate` | SCR-43, SCR-42 | PAY-TEST-003, SYNC-TEST-003 |
| PAY-007 | F-PAY-4 | FL-28 | LedgerEntry | ledger_entries | `POST …/refunds` · op ledger.refund | SCR-46 | PAY-TEST-006, SYNC-TEST-017 |
| PAY-008 | F-PAY-5 | FL-12 | Workspace, Property, Document | workspaces, properties, documents | `PATCH {ws}`, `PATCH {ws}/properties/{id}` | SCR-92 | UI-TEST-009 |
| PAY-009 | F-PAY-6 | FL-12 | Tenancy | audit_events (reminder noted) | Android/web share intents + `POST …/reminders` · op tenancy.reminder_noted | SCR-54 | UI-TEST-009 |
| DEP-001 | F-DEP-1 | FL-05 | LedgerEntry (DEPOSIT) | ledger_entries | `POST {ws}/tenancies`, `…/payments` | SCR-40, SCR-43 | FIN-TEST-015, PAY-TEST-005 |
| DEP-002 | F-DEP-1 | FL-19 | LedgerEntry | ledger_entries | `GET {ws}/reports/deposits` | SCR-42, SCR-81 | REP-TEST-005, FIN-TEST-015 |
| DEP-003 | F-DEP-2 | FL-13 | LedgerEntry | ledger_entries | `…/charges` (DEPOSIT), `…/credits` (DEPOSIT), `…/refunds` | SCR-44, SCR-45, SCR-46 | FIN-TEST-015, FIN-TEST-016 |
| DEP-004 | F-DEP-3, F-MOUT-3 | FL-19 | Settlement, LedgerEntry | settlements, ledger_entries | `…/settlement/finalize`, `…/deposit-applications` | SCR-51, SCR-46 | SETTLE-TEST-001, FIN-TEST-018…020 |
| DEP-005 | F-DEP-3 | FL-19 | LedgerEntry | ledger_entries | refunds, deposit-applications, void | SCR-46 | DEP-TEST-001, FIN-TEST-016 |

### 2.4 Move-in, move-out, utilities, expenses, documents

| Req | Feature | Flow | Entity | Tables | API | Screens | Tests |
|---|---|---|---|---|---|---|---|
| MOVEIN-001 | F-MIN-1 | FL-06 | Inspection, InspectionItem | inspections, inspection_items | `PUT {ws}/inspections/{id}` · op inspection.save | SCR-55 | UI-TEST-002, TNCY-TEST-001 |
| MOVEIN-002 | F-MIN-2 | FL-06 | MeterReading | meter_readings | `POST {ws}/tenancies` (readings) | SCR-40, SCR-62 | UTIL-TEST-005, TNCY-TEST-001 |
| MOVEIN-003 | F-MIN-3 | FL-05 | LedgerEntry | ledger_entries | `POST {ws}/tenancies/preview` | SCR-40 | FIN-TEST-008, FIN-TEST-014, UI-TEST-002 |
| MOVEOUT-001 | F-MOUT-1 | FL-18 | Tenancy | tenancies | `POST/DELETE …/notice` · op tenancy.notice_set | SCR-49 | TNCY-TEST-002, RENT-TEST-004, NOTIF-TEST-003 |
| MOVEOUT-002 | F-MOUT-2 | FL-18 | Tenancy, MeterReading, Inspection, Settlement | tenancies, meter_readings, inspections, settlements | `POST …/move-out`, `…/undo-move-out` | SCR-50 | TNCY-TEST-008, UI-TEST-003 |
| MOVEOUT-003 | F-MOUT-3 | FL-19 | Settlement, LedgerEntry | settlements, ledger_entries | `GET/PUT …/settlement`, `…/finalize`, `{ws}/settlements/{id}/pdf` | SCR-51 | SETTLE-TEST-001…003, FIN-TEST-018…020 |
| MOVEOUT-004 | F-MOUT-3 | FL-19, FL-20 | Tenancy | tenancies | money ops → TENANCY_CLOSED | SCR-42 | PAY-TEST-007, SYNC-TEST-016 |
| MOVEOUT-005 | F-MOUT-4 | FL-19 | Settlement | settlements, ledger_entries | `POST {ws}/settlements/{id}/reopen` | SCR-51 | SETTLE-TEST-004, PERM-TEST-005 |
| UTIL-001 | F-UTIL-1 | FL-14 | Meter | meters | `{ws}/meters` | SCR-60, SCR-61 | UTIL-TEST-001 |
| UTIL-002 | F-UTIL-2 | FL-14 | MeterReading | meter_readings | `POST {ws}/readings` · op reading.create | SCR-62 | UTIL-TEST-001, UTIL-TEST-002 |
| UTIL-003 | F-UTIL-2 | FL-14 | LedgerEntry, MeterReading | ledger_entries, meter_readings | `POST {ws}/readings` (+charge), `…/readings/preview` | SCR-62 | FIN-TEST-012, UTIL-TEST-003, UTIL-TEST-005 |
| UTIL-004 | F-UTIL-3 | FL-15 | MeterReading, LedgerEntry | meter_readings, ledger_entries | `GET …/readings-round`, `POST {ws}/readings` × n | SCR-63 | UTIL-TEST-004, UI-TEST-004 |
| UTIL-005 | F-RENT-2 | FL-14 | LedgerEntry | ledger_entries | `POST …/charges` (UTILITY) | SCR-44 | FIN-TEST-007 |
| EXP-001 | F-EXP-1 | FL-16 | Expense | expenses | `POST {ws}/expenses` · op expense.create | SCR-72 | REP-TEST-006 |
| EXP-002 | F-EXP-1 | FL-16 | Expense | expenses, audit_events | `PATCH`, `…/void` | SCR-72 | SYNC-TEST-004, TEAM-TEST-004 |
| DOC-001 | F-DOC-1 | FL-06 | Document | documents | `POST {ws}/documents`, `…/upload-url`, `…/complete` | SCR-76 | DOC-TEST-001 |
| DOC-002 | F-DOC-1 | — | Document | documents | `POST {ws}/documents` | SCR-76 | SEC-TEST-002 |
| DOC-003 | F-DOC-1 | FL-06, FL-27 | Document | documents (+ Android local_files) | op document.create + upload worker | SCR-76, SCR-98 | OFF-TEST-003 |
| DOC-004 | F-DOC-2 | — | Document, Audit event | documents, audit_events | `GET …/documents/{id}/download-url` | SCR-75 | SEC-TEST-002, PERM-TEST-003 |
| DOC-005 | F-DOC-3 | — | Document | documents | `DELETE`, `…/restore` | SCR-77 | DOC-TEST-003, DOC-TEST-004 |
| DOC-006 | F-DOC-1 | — | Workspace, Document | workspaces | `POST {ws}/documents` | SCR-76 | DOC-TEST-002 |

### 2.5 Notifications, reports, search, sync, settings

| Req | Feature | Flow | Entity | Tables | API | Screens | Tests |
|---|---|---|---|---|---|---|---|
| NOTIF-001 | F-NOT-1 | FL-12 | Notification | notifications, device_tokens | cron `digests` | SCR-85 | NOTIF-TEST-001, NOTIF-TEST-002 |
| NOTIF-002 | F-NOT-2 | — | Notification | notifications | `GET {ws}/notifications`, read endpoints | SCR-85 | NOTIF-TEST-003 |
| NOTIF-003 | F-NOT-3 | FL-25, FL-26 | — | — | email provider | — | TEAM-TEST-001, ACC-TEST-003 |
| NOTIF-004 | F-NOT-2 | — | Member | memberships (notification_prefs, digest_time) | `GET/PUT …/notification-preferences` | SCR-95 | NOTIF-TEST-001 |
| NOTIF-005 | F-NOT-4 | FL-27 | — | (Android pending_ops) | — | SCR-98 | NOTIF-TEST-004 |
| REP-001 | F-DASH-1 | — | (derived) | ledger_entries, expenses, tenancies, units | `GET {ws}/dashboard` | SCR-10 | REP-TEST-001, PERF-TEST-002 |
| REP-002 | F-REP-1 | — | (derived) | units, tenancies, rent_revisions, ledger_entries | `GET {ws}/reports/rent-roll` | SCR-81 | REP-TEST-009 |
| REP-003 | F-REP-1 | FL-12 | (derived) | v_charge_allocation | `GET {ws}/reports/aging` | SCR-81 | REP-TEST-002, FIN-TEST-021 |
| REP-004 | F-REP-1 | — | LedgerEntry | ledger_entries | `GET {ws}/reports/collections`, `GET {ws}/payments` | SCR-81, SCR-70 | REP-TEST-003 |
| REP-005 | F-REP-2 | FL-24 | LedgerEntry | ledger_entries | `GET …/statement` | SCR-53 | REP-TEST-004, UI-TEST-007 |
| REP-006 | F-REP-1 | — | LedgerEntry | ledger_entries | `GET {ws}/reports/deposits` | SCR-81 | REP-TEST-005 |
| REP-007 | F-REP-1 | — | Expense | expenses | `GET {ws}/reports/expenses` | SCR-81 | REP-TEST-006 |
| REP-008 | F-REP-1 | — | (derived) | ledger_entries, expenses, units | `GET {ws}/reports/property-income` | SCR-81 | REP-TEST-006 |
| REP-009 | F-REP-1 | FL-20 | Unit, Tenancy | units, tenancies | `GET {ws}/reports/vacancy`, `…/lease-expiry` | SCR-81 | REP-TEST-007 |
| REP-010 | F-REP-3 | FL-24 | all | all | `GET {ws}/exports/full.zip` | SCR-82 | REP-TEST-008 |
| SRCH-001 | F-SRCH-1 | — | Tenant, Unit, Property, LedgerEntry | tenants (trigram), units, properties, ledger_entries | `GET {ws}/search` | SCR-86 | API-TEST-007 |
| SRCH-002 | F-SRCH-2 | — | — | — | list query parameters | SCR-10, SCR-70, SCR-81 | API-TEST-004 |
| SYNC-001 | F-SYNC-1 | FL-27 | all synced | Room mirror | `sync/pull`, `sync/push` | SCR-98 | OFF-TEST-001, SYNC-TEST-001 |
| SYNC-002 | F-SYNC-1 | FL-27 | — | pending_ops | `sync/push` | SCR-98 | SYNC-TEST-002, SYNC-TEST-018 |
| SYNC-003 | F-SYNC-1 | FL-27 | — | sync_ops | `sync/push`; client ids; Idempotency-Key | — | SYNC-TEST-002, API-TEST-001, API-TEST-002 |
| SYNC-004 | F-SYNC-1 | FL-27 | — | version columns, workspace_counters | `sync/pull` | — | SYNC-TEST-007, SYNC-TEST-008, SYNC-TEST-014 |
| SYNC-005 | F-SYNC-1 | FL-27 | — | constraints, ledger guard | `sync/push` | SCR-98 | SYNC-TEST-003…006, SYNC-TEST-016, SYNC-TEST-017 |
| SYNC-006 | F-SYNC-1 | FL-27 | — | pending_ops | — | SCR-98 | UI-TEST-005 |
| SYNC-007 | F-SYNC-1 | — | — | — | pull triggers | — | SYNC-TEST-009, OFF-TEST-001 |
| SYNC-008 | F-SYNC-1, F-ACC-2 | FL-27 | — | pending_ops (user_id) | — | SCR-98 | SYNC-TEST-012 |
| SYNC-009 | F-SYNC-1 | — | — | — | `GET /meta`, 426 | — | SYNC-TEST-013, API-TEST-006 |
| SET-001 | F-SET-1 | — | Workspace | workspaces | `PATCH {ws}` | SCR-91 | PERM-TEST-001, FIN-TEST-011 |
| SET-002 | F-SET-2 | — | — | — | — | SCR-96 | Release checklist 14 §6 (items 4–5) |

## 3. Non-functional requirements

| Req | Verified by |
|---|---|
| NFR-001 Performance | PERF-TEST-001…003 |
| NFR-002 Scale | PERF-TEST-001, PERF-TEST-002 (seeds `agency`, `large`) |
| NFR-003 Availability | Uptime monitoring and alerts (06 §11), provider SLAs |
| NFR-004 Durability | SYNC-TEST-002, SYNC-TEST-018, quarterly restore drill (14 §6 item 7) |
| NFR-005 Security | SEC-TEST-001…010, PERM-TEST-001…006, external review (11 §19) |
| NFR-006 Localization-ready | Android lint (hardcoded text), web i18n lint, 14 §6 item 4 |
| NFR-007 Accessibility | UI-TEST-008, 14 §6 item 5 |
| NFR-008 Platforms | 14 §6 item 1 (device matrix), Playwright browsers |
| NFR-009 Money correctness | FIN-TEST-001…024 in Kotlin, TypeScript and SQL |
| NFR-010 Auditability | TEAM-TEST-004, SEC-TEST-002 |
| NFR-011 Cost | Monthly usage review against 06 §14 |
| NFR-012 Privacy readiness | SEC-TEST-009, SEC-TEST-010, legal review [LEGAL CHECK] |
| NFR-013 Observability | SEC-TEST-010 (scrubbing), alert checks in 06 §11 |

## 4. Reverse index (impact of changing a central artefact)

| Artefact | Requirements affected |
|---|---|
| `ledger_entries` / `v_charge_allocation` | RENT-001…009, PAY-001…007, DEP-001…005, MOVEIN-003, MOVEOUT-003…005, UTIL-003…005, REP-001…006, REP-008, REP-010, SYNC-005 |
| `10_FINANCIAL_RULES.md` (any formula) | All of the row above + FIN-TEST vectors (must be updated in the same change) |
| `tenancies` (incl. exclusion constraint) | TENANCY-001…009, UNIT-003, UNIT-005, MOVEOUT-001…004, REP-002, REP-009 |
| `sync/push` or op payload schema | SYNC-001…009, every "op …" in §2 (bump op `schema`, keep old schema ≥ 6 months, 08 §14) |
| `can()` / permissions matrix (01 §12) | TEAM-003…007, DOC-004, all PERM-TEST, sync scope (08 §2) |
| `documents` / storage flow | DOC-001…006, PAY-008 (QR), MOVEIN-001, MOVEOUT-002/003 |
| Receipt numbering (`workspace_counters`) | PAY-005, REP-004, SRCH-001 |
| Workspace time zone logic | RENT-001, RENT-005, NOTIF-001, REP-001, REP-003 |

## 5. Version 1 requirements (planned trace)

Tests are added to 14 when each V1 milestone starts.

| Req | Feature | Milestone | Main artefacts |
|---|---|---|---|
| ACC-006 | F-V1-1 | V1-M1 | Supabase phone OTP; SMS provider |
| TEAM-008 | F-V1-5 | V1-M5 | memberships.role STAFF; `can()` rules |
| OWN-002 | 13 §12 | V1-M5 | owner statement query |
| PROP-006 | — | V1-M5 | property tags |
| TENANT-007 | — | V1-M5 | anonymize command; audit redaction |
| TENANCY-010 | — | V1-M5 | linked INTERNAL_TRANSFER entries |
| RENT-008 | F-V1-6 | V1-M5 | late_fee_rule; job; FIN-TEST-022 |
| PAY-010 | F-V1-1 | V1-M1 | payment_claims |
| MOVEIN-004 | — | V1-M5 | PDF template |
| UTIL-006 | — | V1-M5 | shared-meter split |
| EXP-003 | — | V1-M5 | recurring expenses |
| NOTIF-006, NOTIF-008 | 12 §3.2 | V1-M1…M5 | tenant notifications, weekly email |
| REP-011, REP-012 | 13 §12 | V1-M5 | utility report, PDF/XLSX |
| SYNC-010 | 08 §9.4 | V1-M5 | silent push |
| SET-003 | — | V1-M5 | inspection templates |
| TPORTAL-001, TPORTAL-002 | F-V1-1 | V1-M1 | tenant_links, `/tenant/*` API |
| NOTICE-001, NOTICE-002 | F-V1-2 | V1-M2 | notices, notice_reads |
| CHAT-001, CHAT-002 | F-V1-3 | V1-M3 | conversations, messages, message_reads, Realtime |
| BILL-001, BILL-002, BILL-003 | F-V1-4 | V1-M4 | subscriptions, provider webhooks |

## 6. Completeness check

Every MVP requirement ID in `01_PRD.md` §9 appears in §2 with at least one test. The only exception is SET-002 (display preferences), which is verified manually through the release checklist. Future requirements (PAY-011, DEP-006, UTIL-007, MAINT-001, NOTIF-007) are intentionally untraced until scheduled.
