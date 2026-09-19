# 07 — API Specification

```text
Version:      0.1
Status:       Draft — awaiting owner review
Last Updated: 2026-09-18
Depends On:   05_DATABASE_DESIGN.md, 06_SYSTEM_ARCHITECTURE.md, 01_PRD.md §12 (permissions)
Affected By:  08_SYNC_SPECIFICATION.md, 10_FINANCIAL_RULES.md, 11_SECURITY_AND_PRIVACY.md
```

One REST API serves the website and the Android app. Android sends **writes** through `POST /sync/push` (batched operations, 08). Every push operation maps 1:1 to a command that is also exposed as a REST endpoint below, so validation and rules are identical.

## 1. Conventions

### 1.1 Base URL and versioning
- `https://<domain>/api/v1`. Workspace resources are under `/api/v1/workspaces/{ws}`, and in the tables below the prefix `{ws}` means that.
- Breaking changes create `/api/v2`. Additive changes (new optional fields) do not. Clients must ignore unknown fields.

### 1.2 Authentication
- Android: `Authorization: Bearer <Supabase access token>`. Web: Supabase session cookie (httpOnly) plus same-origin requests.
- Token verified with Supabase JWKS. Missing or invalid → `401 UNAUTHENTICATED`.
- Public endpoints (no auth): `GET /meta`, `GET /health`.

### 1.3 Authorization
- Caller must have an ACTIVE membership in `{ws}`. Otherwise `404 NOT_FOUND`, so the existence of a workspace is not revealed.
- Role and property scope per `01_PRD.md` §12. A resource outside the caller's scope returns `404`. An action not allowed for the role on an accessible resource returns `403 FORBIDDEN`.

### 1.4 Data formats
| Type | Format | Example |
|---|---|---|
| IDs | UUID string | `"8b0c…"` |
| Money | integer minor units + ISO currency | `"amount_minor": 1500000, "currency": "INR"` (= ₹15,000.00) |
| Decimal (rates, readings) | string | `"rate": "9.5000"`, `"value": "4951.500"` |
| Date | `YYYY-MM-DD` | `"2026-10-05"` |
| Timestamp | ISO 8601 UTC | `"2026-09-18T10:42:00Z"` |
| Field names | snake_case | |
| Resource envelope | object with `id`, `version`, `created_at`, `updated_at`, `created_by`, `updated_by` | |

### 1.5 Pagination, filtering, sorting
- Cursor pagination: `?limit=50&cursor=<opaque>` → `{ "data": [...], "next_cursor": "..." | null }`. Default 50, max 200.
- Filters are named query parameters per endpoint (listed below). Multi-values are comma-separated (`property_ids=a,b`).
- Sorting: `sort=field` or `sort=-field` (descending), comma-separated for tie-breaks. Only the listed sort fields are accepted (`422` otherwise).

### 1.6 Errors
`Content-Type: application/problem+json`
```json
{
  "type": "https://docs.rentmanager.app/errors/deposit-insufficient",
  "title": "Deposit held is not enough",
  "status": 409,
  "code": "DEPOSIT_INSUFFICIENT",
  "detail": "Deposit held is ₹10,000; you tried to refund ₹15,000.",
  "errors": [{ "field": "amount_minor", "code": "TOO_LARGE", "message": "Max 1000000" }],
  "request_id": "req_01J…"
}
```

| Code | HTTP | Meaning |
|---|---|---|
| VALIDATION_FAILED | 422 | Field errors in `errors[]` |
| UNAUTHENTICATED | 401 | No/invalid token |
| FORBIDDEN | 403 | Role not allowed |
| NOT_FOUND | 404 | Missing or outside scope |
| ID_CONFLICT | 409 | Same id already used with a different payload |
| DUPLICATE_NAME | 409 | Property name / unit label / meter label exists |
| UNIT_OCCUPIED | 409 | Tenancy dates overlap another tenancy (details include the other tenancy) |
| TENANCY_NOT_ACTIVE | 409 | Action needs an ACTIVE tenancy |
| TENANCY_CLOSED | 409 | Tenancy is CLOSED or CANCELLED |
| TENANCY_HAS_PAYMENTS | 409 | Cancel blocked by payments/refunds/applications |
| TENANCY_ACTIVE | 409 | Archive/delete blocked by an ACTIVE tenancy |
| HAS_DEPENDENCIES | 409 | Delete blocked by dependent records |
| CURRENCY_LOCKED | 409 | Property currency cannot change |
| TERMS_LOCKED | 409 | Start/cycle/billing start cannot change after payments (BR-026) |
| PERIOD_NOT_ALIGNED | 422 | Date is not a period start |
| REVISION_EXISTS | 409 | Rent revision already exists for that date |
| DEPOSIT_INSUFFICIENT | 409 | Would make deposit held negative |
| DEPOSIT_EXCEEDS_DUE | 409 | Deposit payment larger than deposit due (increase the deposit first) |
| APPLY_EXCEEDS_BALANCE | 409 | Deposit application > positive rent balance |
| REFUND_EXCEEDS_CREDIT | 409 | Rent refund > advance credit |
| ENTRY_IN_SETTLEMENT | 409 | Entry belongs to a finalized settlement |
| SETTLEMENT_EXISTS | 409 | An open settlement exists |
| SETTLEMENT_STALE | 409 | Totals changed; body contains the new preview |
| READING_LOWER_THAN_PREVIOUS | 422 | Reading < previous without replacement |
| READING_DUPLICATE | 409 | Reading for meter/date/type exists |
| SHARES_INVALID | 422 | Ownership shares do not total 100% |
| QUOTA_EXCEEDED | 409 | Storage quota reached |
| INVITE_EXPIRED | 410 | Invite expired/revoked |
| INVITE_EMAIL_MISMATCH | 403 | Signed-in email differs from invite |
| OWNER_REQUIRED | 409 | Operation would leave no Owner |
| CLIENT_TOO_OLD | 426 | App version below minimum |
| RATE_LIMITED | 429 | With `Retry-After` |
| CONFLICT_DELETED | 409 | Target was deleted (mainly sync) |
| DEPENDENCY_FAILED | 409 | Sync only: an earlier op in the batch this op depends on failed |
| RESYNC_REQUIRED | 409 | Sync only: the client's cursor is below the workspace purge floor; run a full initial sync |
| INTERNAL | 500 | Unexpected; retry later |

### 1.7 Idempotency and concurrency
- **Creates:** the client supplies `id` (UUID v4). Repeating a create with the same `id` and identical payload returns `200` with the existing resource. The same `id` with a different payload returns `409 ID_CONFLICT`.
- **Actions** (void, archive, finalize, cancel, move-out, notice…) accept `Idempotency-Key: <uuid>`. The first result is stored (in `sync_ops`, 90 days) and replayed for repeats. Android push operations always carry `op_id`, which serves the same purpose.
- **Updates** (`PATCH`) change only the fields sent: field-level last-write-wins (D-020). Every response includes `version`. There is no `If-Match` in the MVP.

### 1.8 Common headers
| Header | Direction | Purpose |
|---|---|---|
| `X-Client` | request | `android/1.4.0+12` or `web/2026.09.18` |
| `X-Device-Id` | request (Android) | Stable random device id (per install) |
| `X-Request-Id` | response | Correlates logs |
| `Retry-After` | response | With 429/503 |

### 1.9 Rate limits (MVP)
Auth endpoints: Supabase built-in limits. API: platform firewall rules (D-049). Push batches ≤ 500 ops and ≤ 5 MB. Exports: 1 concurrent per workspace.

## 2. Resource shapes

### 2.1 Tenancy (response)
```json
{
  "id": "7d1e…", "version": 18423,
  "property_id": "…", "unit_id": "…", "status": "ACTIVE", "currency": "INR",
  "start_date": "2026-09-18", "billing_start_date": "2026-09-18", "lease_end_date": "2027-08-31",
  "cycle_day": 1, "grace_days": 4, "notice_period_days": 30, "deposit_agreed_minor": 3000000,
  "notice_given_on": null, "planned_move_out_date": null, "moved_out_on": null,
  "parties": [{ "id": "…", "tenant_id": "…", "role": "PRIMARY", "joined_on": "2026-09-18", "left_on": null }],
  "summary": {
    "rent_balance_minor": 650000, "overdue_minor": 0, "advance_minor": 0,
    "deposit_due_minor": 0, "deposit_held_minor": 3000000,
    "current_rent_minor": 1500000, "next_due_date": "2026-10-05",
    "last_reminder_at": null, "last_reminder_by": null,
    "labels": []
  },
  "created_at": "…", "updated_at": "…", "created_by": "…", "updated_by": "…"
}
```

### 2.2 Ledger entry (response)
```json
{
  "id": "c4a2…", "version": 18431, "tenancy_id": "7d1e…",
  "kind": "PAYMENT", "account": "RENT", "category": null,
  "amount_minor": 1500000, "currency": "INR",
  "entry_date": "2026-10-03", "due_date": null, "period_start": null, "period_end": null,
  "description": null, "method": "UPI", "reference": "UTR 4251…", "note": null,
  "receipt_number": "R-000123", "source": "MANUAL",
  "status": "ACTIVE", "void_reason": null, "possible_duplicate_of": null,
  "allocation": null
}
```
For charges, `allocation` = `{ "paid_minor": 1000000, "remaining_minor": 500000, "state": "PARTLY_PAID", "overdue": true }` (derived, read-only).

## 3. Endpoints

Columns: **Roles** follows `01` §12 (O=Owner, A=Admin, M=Manager, V=Viewer; "scoped" = assigned properties). "Idem." = idempotency mechanism.

### 3.1 Meta and account

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `GET /meta` | public | → `{api_version, min_client_version, server_time}` | — | — |
| `GET /health` | public | → `{status:"ok"}` (checks DB) | 503 if DB down | — |
| `GET /me` | any user | → profile + memberships `[{workspace_id, name, role, all_properties, property_ids}]` | 401 | — |
| `PATCH /me` | self | `{full_name?, phone?, locale?}` → profile | name 1–100; E.164 | — |
| `POST /me/sign-out-all` | self | → 204 | — | Idempotent by nature |
| `POST /me/delete` | self | `{confirm:"DELETE", reason?}` → `{deletion_date}` | 409 OWNER_REQUIRED if Owner of workspace with members | Idempotency-Key |
| `POST /me/delete/cancel` | self (in grace) | → 204 | 404 if not pending | Idempotent |
| `POST /devices` | self | `{token, platform, app_version}` → 204 | token ≤ 4096 chars | Upsert by token |
| `DELETE /devices/{token}` | self | → 204 | — | Idempotent |

### 3.2 Workspaces, members, audit

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `POST /workspaces` | any user | `{id, name, country_code, default_currency, time_zone}` → workspace | codes valid; ≤ 5 workspaces per user in beta (409) | client id |
| `GET {ws}` | all | → workspace (settings) | — | — |
| `PATCH {ws}` | O, A | settings fields (SET-001, PAY-008) → workspace | prefix ≤ 10 `[A-Za-z0-9/-]`; https links | — |
| `POST {ws}/delete` | O | `{confirm_name}` → `{deletion_date}` | name must match | Idempotency-Key |
| `POST {ws}/delete/cancel` | O | → 204 | — | Idempotent |
| `POST {ws}/transfer-ownership` | O | `{membership_id}` → members | target ACTIVE Admin; else 422 | Idempotency-Key |
| `GET {ws}/members` | all | → members (no token hashes) | — | `sort=display_name,role` |
| `POST {ws}/invites` | O, A | `{id, email, role, all_properties, property_ids[]}` → membership (INVITED) | role ∈ {ADMIN, MANAGER, VIEWER} (never OWNER); scoped access needs ≥ 1 property; 409 if already a member | client id |
| `POST {ws}/invites/{id}/resend` | O, A | → 204 (new token, 7 days) | only INVITED | Idempotency-Key |
| `DELETE {ws}/invites/{id}` | O, A | → 204 (REVOKED) | — | Idempotent |
| `POST /invites/accept` | signed-in user | `{token}` → membership + workspace | 410 INVITE_EXPIRED; 403 INVITE_EMAIL_MISMATCH | Idempotent (already ACTIVE → 200) |
| `PATCH {ws}/members/{id}` | O, A | `{role?, all_properties?, property_ids?}` → membership | cannot change OWNER; A cannot promote to OWNER | — |
| `DELETE {ws}/members/{id}` | O, A (self-leave: any) | → 204 (REVOKED) | 409 OWNER_REQUIRED for Owner | Idempotent |
| `GET {ws}/audit-events` | O, A | filters: `entity_type, entity_id, actor_user_id, action, from, to` → events | range ≤ 366 days | cursor; `sort=-created_at` |

### 3.3 Owners

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `GET {ws}/owners` | all | → owners (with property shares) | — | `q`, `sort=name` |
| `POST {ws}/owners` | O, A, M | `{id, name, phone?, email?, address?, notes?}` → owner | name 1–120 | client id |
| `PATCH {ws}/owners/{id}` | O, A, M | fields → owner | — | — |
| `DELETE {ws}/owners/{id}` | O, A | → 204 | 409 HAS_DEPENDENCIES if linked | Idempotent |
| `PUT {ws}/properties/{id}/owners` | O, A, M (scoped) | `[{owner_id, share_bps}]` → list | 422 SHARES_INVALID unless single owner = 10000 or sum = 10000 | Idempotent (full replace) |

### 3.4 Properties and units

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `GET {ws}/properties` | all (scoped) | filters `archived, type, q` → properties + `stats {units_total, units_occupied, outstanding_by_currency[]}` | — | cursor; `sort=name,-outstanding,occupancy` |
| `POST {ws}/properties` | O, A, M(all) | `{id, name, type, address…, country_code, currency, notes?, payment_instructions?}` → property (+ unit "Main" for INDEPENDENT_HOUSE) | 409 DUPLICATE_NAME; codes | client id |
| `GET {ws}/properties/{id}` | all (scoped) | → property + owners + stats | 404 | — |
| `PATCH {ws}/properties/{id}` | O, A, M (scoped) | fields → property | 409 CURRENCY_LOCKED; changing `payment_instructions` requires O/A (403 otherwise) | — |
| `POST {ws}/properties/{id}/archive` | O, A | → property | 409 TENANCY_ACTIVE | Idempotency-Key |
| `POST {ws}/properties/{id}/unarchive` | O, A | → property | — | Idempotent |
| `DELETE {ws}/properties/{id}` | O, A | → 204 | 409 HAS_DEPENDENCIES | Idempotent |
| `GET {ws}/properties/{id}/units` | all (scoped) | filters `archived, status` → units with derived `occupancy_status` | — | `sort=label,floor_label` |
| `POST {ws}/properties/{id}/units` | O, A, M (scoped) | `{id, label, type, floor_label?, area_value?, area_uom?, default_rent_minor?, default_deposit_minor?, notes?}` → unit | 409 DUPLICATE_NAME | client id |
| `POST {ws}/properties/{id}/units/bulk` | O, A, M (scoped) | `{units:[{id, label, …}]}` (≤ 200) → units | all-or-nothing; 409 lists colliding labels | client ids |
| `GET/PATCH {ws}/units/{id}` | read all; write O, A, M | fields → unit (+ current tenancy summary, history) | 409 DUPLICATE_NAME | — |
| `POST {ws}/units/{id}/archive` / `unarchive` | O, A, M | → unit | 409 TENANCY_ACTIVE | Idempotency-Key |
| `DELETE {ws}/units/{id}` | O, A, M | → 204 | 409 HAS_DEPENDENCIES | Idempotent |

### 3.5 Tenants

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `GET {ws}/tenants` | all (scoped visibility, 04 §4.6) | filters `status=current,former,all; q; property_id` → tenants + `balance_minor_by_currency` | — | cursor; `sort=full_name,-balance` |
| `POST {ws}/tenants` | O, A, M | `{id, kind, full_name, phone?, alt_phone?, email?, address?, emergency_name?, emergency_phone?, id_type?, id_last4?, notes?}` → tenant + `possible_duplicates[]` | name 1–120; phone E.164; id_last4 ≤ 4 | client id |
| `GET {ws}/tenants/duplicates` | O, A, M | `?phone=&email=` → matching tenants | — | — |
| `GET/PATCH {ws}/tenants/{id}` | read all; write O, A, M | → tenant + tenancies summary | as create | — |
| `POST {ws}/tenants/{id}/archive` / `unarchive` | O, A, M | → tenant | 409 TENANCY_ACTIVE | Idempotency-Key |
| `DELETE {ws}/tenants/{id}` | O, A, M | → 204 | 409 HAS_DEPENDENCIES | Idempotent |

### 3.6 Tenancies

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `GET {ws}/tenancies` | all (scoped) | filters `status, property_id, unit_id, tenant_id, labels (upcoming,on_notice,lease_expired,overdue)` → tenancies with summary | — | cursor; `sort=-start_date,unit_label,-rent_balance` |
| `POST {ws}/tenancies/preview` | O, A, M | same body as create minus ids → proposed entries (§4.1) | as create | — (pure) |
| `POST {ws}/tenancies` | O, A, M (scoped) | §4.1 → tenancy + created entries | §4.1 | client id (atomic) |
| `GET {ws}/tenancies/{id}` | all (scoped) | → tenancy (§2.1) | 404 | — |
| `PATCH {ws}/tenancies/{id}` | O, A, M | `{lease_end_date?, notice_period_days?, grace_days?, notes?, start_date?, cycle_day?, billing_start_date?}` → tenancy | 409 TERMS_LOCKED for start/cycle/billing start after first payment; grace change applies to future charges | — |
| `POST {ws}/tenancies/{id}/parties` | O, A, M | `{id, tenant_id, role, joined_on?}` → party | one PRIMARY rule (promotes/demotes) | client id |
| `PATCH {ws}/tenancies/{id}/parties/{party_id}` | O, A, M | `{role?, left_on?}` → party | cannot leave without a PRIMARY | — |
| `GET {ws}/tenancies/{id}/schedule` | all | `?periods=12` → `[{period_start, period_end, due_date, rent_minor, recurring:[…]}]` | periods 1–24 | — |
| `POST {ws}/tenancies/{id}/rent-revisions/preview` | O, A, M | `{effective_from, rent_minor}` → `{adjustments:[{period_start, kind, amount_minor, description}]}` | 422 PERIOD_NOT_ALIGNED | — |
| `POST {ws}/tenancies/{id}/rent-revisions` | O, A, M | `{id, effective_from, rent_minor, reason?, adjustments:[{id, kind, amount_minor, entry_date, due_date, description}]}` → revision + entries | 409 REVISION_EXISTS; TENANCY_NOT_ACTIVE | client id (atomic) |
| `POST {ws}/tenancies/{id}/recurring-charges` | O, A, M | `{id, category, label, amount_minor, effective_from, effective_to?}` → item | dates within tenancy | client id |
| `PATCH {ws}/recurring-charges/{id}` | O, A, M | `{effective_to}` → item | ≥ effective_from | — |
| `POST {ws}/tenancies/{id}/notice` | O, A, M | `{notice_given_on, planned_move_out_date, given_by}` → tenancy | planned ≥ notice; 409 UNIT_OCCUPIED if new occupancy collides | Idempotency-Key |
| `DELETE {ws}/tenancies/{id}/notice` | O, A, M | → tenancy | — | Idempotent |
| `POST {ws}/tenancies/{id}/cancel` | O, A (M if only charges) | `{reason}` → tenancy CANCELLED (+ voided entries) | 409 TENANCY_HAS_PAYMENTS | Idempotency-Key |
| `POST {ws}/tenancies/{id}/reminders` | O, A, M | `{channel (WHATSAPP, SMS, EMAIL, OTHER), tenant_id}` → 204; writes audit event REMINDER; updates `summary.last_reminder_at/by` | tenant is a party | Idempotency-Key |
| `POST {ws}/tenancies/{id}/move-out` | O, A, M | §4.4 → tenancy ENDED + settlement draft | §4.4 | Idempotency-Key (atomic) |
| `POST {ws}/tenancies/{id}/undo-move-out` | O, A, M | → tenancy ACTIVE (draft removed, move-out readings voided) | 409 if settlement FINALIZED | Idempotency-Key |
| `GET {ws}/tenancies/{id}/ledger` | all (scoped) | filters `account, kind, include_void` → entries with allocation + `running_balance_minor` | — | cursor; `sort=-entry_date` (default) |
| `GET {ws}/tenancies/{id}/statement` | O, A, M, V | `?from&to&format=json|pdf|csv` → statement (13 §7) | range within tenancy | — |

### 3.7 Money entries

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `POST {ws}/tenancies/{id}/charges` | O, A, M | §4.2 → entry | §4.2 | client id |
| `POST {ws}/tenancies/{id}/payments` | O, A, M | §4.3 → entry (+ receipt_number, possible_duplicate_of) | §4.3 | client id |
| `POST {ws}/tenancies/{id}/credits` | O, A, M | `{id, account, category, amount_minor, entry_date, note}` → entry | category per 10 §2; note 3–500 required; DEPOSIT credits ≤ deposit due | client id |
| `POST {ws}/tenancies/{id}/refunds` | O, A, M | `{id, account, amount_minor, entry_date, method, reference?, note?}` → entry | RENT: 409 REFUND_EXCEEDS_CREDIT; DEPOSIT: 409 DEPOSIT_INSUFFICIENT | client id |
| `POST {ws}/tenancies/{id}/deposit-applications` | O, A, M | `{id, amount_minor, entry_date, note}` → entry | 409 DEPOSIT_INSUFFICIENT / APPLY_EXCEEDS_BALANCE | client id |
| `PATCH {ws}/ledger-entries/{id}` | O, A, M | `{note?, reference?}` → entry | other fields → 422 (immutable) | — |
| `POST {ws}/ledger-entries/{id}/void` | O, A, M | `{reason}` (3–500) → entry VOID | 409 ENTRY_IN_SETTLEMENT, TENANCY_CLOSED, DEPOSIT_INSUFFICIENT; already VOID → 200 | Idempotent |
| `POST {ws}/ledger-entries/{id}/dismiss-duplicate` | O, A, M | → entry with `possible_duplicate_of = null` (audited) | only when flagged; otherwise 200 no-op | Idempotent |
| `GET {ws}/payments` | all (scoped) | filters `from, to, property_ids, tenancy_id, method, account, recorded_by, include_void` → payments & refunds | range ≤ 5 years | cursor; `sort=-entry_date,receipt_number` |
| `GET {ws}/payments/{id}/receipt` | O, A, M, V | `?format=pdf` → PDF | 409 if no receipt number (pending/opening/transfer) | — |

### 3.8 Settlement

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `GET {ws}/tenancies/{id}/settlement` | O, A, M, V | → draft + computed preview (10 §10) | 404 if none | — |
| `PUT {ws}/tenancies/{id}/settlement` | O, A, M | `{lines:[…]}` (deductions, overrides, line removals) → draft + preview | deduction amount > 0 + reason | Idempotent (replace) |
| `POST {ws}/tenancies/{id}/settlement/finalize` | O, A, M | §4.5 → settlement FINALIZED + entries + tenancy | 409 SETTLEMENT_STALE (body = new preview); TENANCY_NOT_ACTIVE-like checks | Idempotency-Key (atomic) |
| `POST {ws}/settlements/{id}/reopen` | O, A | `{reason, keep_refund_entry_ids[]}` → settlement VOID + tenancy ENDED | only FINALIZED | Idempotency-Key |
| `GET {ws}/settlements/{id}/pdf` | O, A, M, V | → PDF | — | — |

### 3.9 Meters and readings

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `GET {ws}/meters` | all (scoped) | filters `property_id, unit_id, type, archived` → meters + last reading | — | `sort=floor_label,label` |
| `POST {ws}/meters` | O, A, M | `{id, property_id, unit_id?, type, label, serial_number?, uom, rate, fixed_charge_minor}` → meter | 409 DUPLICATE_NAME; rate ≥ 0 ≤ 1,000,000 | client id |
| `PATCH {ws}/meters/{id}` | O, A, M | fields → meter | rate change affects future charges only | — |
| `POST {ws}/meters/{id}/archive` | O, A, M | → meter | — | Idempotent |
| `GET {ws}/meters/{id}/readings` | all | → readings | — | cursor; `sort=-reading_date` |
| `POST {ws}/readings/preview` | O, A, M | `{meter_id, reading_date, value, replacement?}` → `{previous, consumption, proposed_charge?}` | as create | — |
| `POST {ws}/readings` | O, A, M | §4.6 → reading(s) + charge? | §4.6 | client id (atomic) |
| `POST {ws}/readings/{id}/void` | O, A, M | `{reason}` → reading VOID | 409 if an ACTIVE charge references it (void the charge first) | Idempotent |
| `GET {ws}/properties/{id}/readings-round` | O, A, M | → rows `{meter, unit, tenancy?, previous_reading}` | — | — |

### 3.10 Expenses

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `GET {ws}/expenses` | all (scoped; workspace-level expenses only for members with all-properties access) | filters `from, to, property_ids, unit_id, category, include_void` → expenses | range ≤ 5 years | cursor; `sort=-expense_date,-amount_minor` |
| `POST {ws}/expenses` | O, A, M | `{id, property_id?, unit_id?, category, amount_minor, currency, expense_date, payee?, method?, reference?, note?}` → expense | currency = property currency (or workspace default); date ≤ today+1 | client id |
| `PATCH {ws}/expenses/{id}` | O, A, M | fields → expense | only ACTIVE | — |
| `POST {ws}/expenses/{id}/void` | O, A, M | `{reason}` → expense | — | Idempotent |

### 3.11 Inspections

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `GET {ws}/tenancies/{id}/inspections` | all (scoped) | → inspections with items | — | — |
| `PUT {ws}/inspections/{id}` | O, A, M | `{tenancy_id, kind, inspected_on, keys_count?, notes?, items:[{id, area, item, condition?, note?, sort_order}]}` → inspection | one per kind per tenancy; ≤ 200 items; tenancy not CLOSED | Idempotent (upsert; items full replace) |
| `POST {ws}/inspections/{id}/complete` | O, A, M | → inspection | — | Idempotent |

### 3.12 Documents

| Method + path | Roles | Request → Response | Validation / errors | List / Idem. |
|---|---|---|---|---|
| `POST {ws}/documents` | O, A, M | `{id, entity_type, entity_id, category, title?, file_name, mime_type, size_bytes}` → document + `{upload_url, expires_at}` | MIME allow-list; ≤ 10 MB; parent exists & in scope; 409 QUOTA_EXCEEDED | client id |
| `POST {ws}/documents/{id}/upload-url` | O, A, M | → new signed upload URL | only PENDING | — |
| `POST {ws}/documents/{id}/complete` | O, A, M | → document UPLOADED | object exists, size/MIME match (else 422) | Idempotent |
| `GET {ws}/documents` | per matrix | `?entity_type&entity_id&category&include_deleted` → documents (sensitive omitted for V; count in `restricted_count`) | — | `sort=-created_at` |
| `GET {ws}/documents/{id}/download-url` | per matrix | → `{url, expires_at}` (5 min) | 403 for sensitive + role V; audit VIEW_SENSITIVE | — |
| `DELETE {ws}/documents/{id}` | O, A, M | → 204 (soft) | 409 if referenced by finalized settlement | Idempotent |
| `POST {ws}/documents/{id}/restore` | O, A, M | → document | within 30 days | Idempotent |

### 3.13 Dashboard, reports, exports, search

All accept `property_ids` (default: all accessible) and return money grouped by currency. Definitions: `13_REPORTING_SPECIFICATION.md`.

| Method + path | Roles | Parameters → Response | Formats |
|---|---|---|---|
| `GET {ws}/dashboard` | all | `month=YYYY-MM` → metrics + lists (13 §2) | json |
| `GET {ws}/reports/rent-roll` | all | `as_of` | json, csv |
| `GET {ws}/reports/aging` | all | `as_of` | json, csv |
| `GET {ws}/reports/collections` | all | `from, to, group_by` (day, month, property, method, account, member), filters `method, account` | json, csv |
| `GET {ws}/reports/deposits` | all | `as_of, status` | json, csv |
| `GET {ws}/reports/expenses` | all | `from, to, group_by=month,property,category` | json, csv |
| `GET {ws}/reports/property-income` | all | `from, to` (months) | json, csv |
| `GET {ws}/reports/vacancy` | all | `as_of` | json, csv |
| `GET {ws}/reports/lease-expiry` | all | `from, to` | json, csv |
| `GET {ws}/exports/full.zip` | O, A | `include_archived=true,false` → streamed ZIP (13 §13) | zip |
| `GET {ws}/search` | all (scoped) | `q` (≥ 2 chars), `limit` ≤ 20 per group → `{tenants, units, properties, receipts}` | json |

Validation: `from ≤ to`, range ≤ 5 years, `month` valid. CSV exports are audited (EXPORT).

### 3.14 Notifications

| Method + path | Roles | Request → Response | List |
|---|---|---|---|
| `GET {ws}/notifications` | self | → notifications | cursor; `sort=-created_at`; `unread=true` |
| `POST {ws}/notifications/{id}/read` | self | → 204 | Idempotent |
| `POST {ws}/notifications/read-all` | self | → 204 | Idempotent |
| `GET {ws}/notification-preferences` | self | → `{digest_enabled, digest_time, events:{…}}` | — |
| `PUT {ws}/notification-preferences` | self | same shape → saved | Idempotent |

### 3.15 Sync (Android)

Specified in `08_SYNC_SPECIFICATION.md` §7–§9.

| Method + path | Purpose |
|---|---|
| `GET {ws}/sync/pull?cursor=&limit=` | Changes since cursor (all synced tables, incl. tombstones), complete versions only |
| `POST {ws}/sync/push` | Batch of ops `{op_id, type, entity_id, data}` → per-op results |
| `GET {ws}/sync/entities?type=&ids=` | Canonical rows for targeted refresh (≤ 100 ids) |

### 3.16 Internal jobs (not public)

`POST /api/internal/cron/{generate-charges | digests | cleanup | storage-reconcile}` with `Authorization: Bearer <CRON_SECRET>` → `{processed, created, errors}`.

### 3.17 Version 1 (outline)

| Area | Endpoints |
|---|---|
| Tenant portal | `POST /tenant/invites/accept`, `GET /tenant/tenancies`, `GET /tenant/tenancies/{id}/ledger`, `GET /tenant/documents/{id}/download-url`, `POST /tenant/tenancies/{id}/payment-claims` |
| Payment claims (landlord) | `GET {ws}/payment-claims`, `POST {ws}/payment-claims/{id}/accept` (creates PAYMENT), `POST …/reject` |
| Notices | `GET/POST {ws}/notices`, `POST {ws}/notices/{id}/archive`, `GET /tenant/notices`, `POST /tenant/notices/{id}/read` |
| Chat | `GET {ws}/conversations`, `GET/POST {ws}/conversations/{id}/messages`, `POST …/read`; tenant equivalents under `/tenant` |
| Billing | `POST {ws}/billing/checkout`, `GET {ws}/billing`, `POST /webhooks/billing` (signature-verified) |

## 4. Detailed request contracts

### 4.1 `POST {ws}/tenancies` (atomic start)
```json
{
  "id": "7d1e…", "mode": "NEW",
  "unit_id": "…",
  "parties": [{ "id": "…", "tenant_id": "…", "role": "PRIMARY" }],
  "start_date": "2026-09-18", "billing_start_date": "2026-09-18",
  "lease_end_date": "2027-08-31", "cycle_day": 1, "grace_days": 4, "notice_period_days": 30,
  "rent": { "id": "…", "rent_minor": 1500000 },
  "deposit_agreed_minor": 3000000,
  "recurring_charges": [{ "id": "…", "category": "MAINTENANCE", "label": "Maintenance", "amount_minor": 100000, "effective_from": "2026-09-18" }],
  "entries": [
    { "id": "…", "kind": "CHARGE", "account": "RENT", "category": "RENT", "amount_minor": 650000,
      "entry_date": "2026-09-18", "due_date": "2026-09-22", "period_start": "2026-09-18", "period_end": "2026-09-30",
      "description": "Rent · 18–30 Sep 2026 (13/30 days)", "generated_key": "rent:7d1e…:2026-09-18" },
    { "id": "…", "kind": "CHARGE", "account": "DEPOSIT", "category": "DEPOSIT", "amount_minor": 3000000,
      "entry_date": "2026-09-18", "due_date": "2026-09-18", "description": "Security deposit" }
  ],
  "readings": [{ "id": "…", "meter_id": "…", "reading_date": "2026-09-18", "value": "4732.000", "reading_type": "MOVE_IN" }],
  "inspection": { "id": "…", "kind": "MOVE_IN", "inspected_on": "2026-09-18", "keys_count": 2, "items": [ … ] },
  "opening": null
}
```
`mode: "EXISTING"` adds `"opening": {"arrears_minor": 2000000 | null, "advance_minor": null, "deposit_held_minor": 3000000}` and requires `billing_start_date` to be a period start.

Validation (server, in addition to 02 F-TNCY-1/2):
- unit in scope and not archived; tenants exist; exactly one PRIMARY.
- `cycle_day` 1–28, `grace_days` 0–60, rent > 0, dates coherent.
- Every `generated_key` entry must match a period computed by the server for this tenancy (key format and period dates). The amount may differ, because the user can edit it.
- Readings obey BR-017. Deposit held ≤ deposit agreed.
- Exclusion constraint → `409 UNIT_OCCUPIED {other_tenancy_id, other_occupancy}`.

Response `201`: tenancy (§2.1) + `entries[]` as stored.

### 4.2 `POST {ws}/tenancies/{id}/charges`
```json
{ "id": "…", "account": "RENT", "category": "UTILITY", "description": "Electricity bill Aug",
  "amount_minor": 185000, "entry_date": "2026-09-10", "due_date": "2026-09-15",
  "period_start": "2026-08-01", "period_end": "2026-08-31" }
```
Rules: `account = DEPOSIT` only with `category = DEPOSIT` (deposit increase). Tenancy status ACTIVE or ENDED. `due_date ≥ entry_date`. `entry_date ≥ start_date − 365 days`.

### 4.3 `POST {ws}/tenancies/{id}/payments`
```json
{ "id": "…", "account": "RENT", "amount_minor": 1500000, "entry_date": "2026-10-03",
  "method": "UPI", "reference": "UTR 4251…", "note": null }
```
Rules: BR-021 date window. Method ∈ user methods (system methods only through tenancy start/settlement). Tenancy not CLOSED/CANCELLED. Server assigns `receipt_number` (next workspace sequence) unless the method is OPENING_BALANCE/INTERNAL_TRANSFER. It sets `possible_duplicate_of` if another ACTIVE payment on the tenancy has the same amount and entry_date and was created in the last 24 h (the response then includes `"warnings": ["POSSIBLE_DUPLICATE"]`).

### 4.4 `POST {ws}/tenancies/{id}/move-out`
```json
{ "moved_out_on": "2027-03-12",
  "readings": [{ "id": "…", "meter_id": "…", "reading_date": "2027-03-12", "value": "6140.000", "reading_type": "MOVE_OUT" }],
  "inspection": { "id": "…", "kind": "MOVE_OUT", "inspected_on": "2027-03-12", "keys_count": 2, "items": [ … ] },
  "settlement_id": "…" }
```
Effects: status ENDED, `moved_out_on` set (occupancy shrinks and must not collide), readings and inspection saved, settlement DRAFT created with the computed proposal (10 §10).

### 4.5 `POST {ws}/tenancies/{id}/settlement/finalize`
```json
{ "settlement_id": "…",
  "lines": [
    { "type": "VOID_CHARGE", "entry_id": "…" },
    { "type": "PRORATION_CREDIT", "id": "…", "amount_minor": 919400 },
    { "type": "UTILITY_CHARGE", "id": "…", "reading_id": "…", "amount_minor": 114000 },
    { "type": "DEDUCTION", "id": "…", "category": "DAMAGE", "amount_minor": 250000, "note": "Broken window", "document_ids": ["…"] },
    { "type": "DEDUCTION", "id": "…", "category": "CLEANING", "amount_minor": 100000, "note": "Deep cleaning" },
    { "type": "DEPOSIT_APPLY", "id": "…", "amount_minor": 1044600 },
    { "type": "REFUND", "id": "…", "account": "DEPOSIT", "amount_minor": 1955400, "method": "BANK_TRANSFER", "entry_date": "2027-03-14", "reference": "IMPS 88…" }
  ],
  "expected": { "rent_balance_after_minor": 0, "deposit_held_after_minor": 0, "refund_due_minor": 1955400, "amount_owed_minor": 0 } }
```
The server applies the lines to its current ledger in a transaction. It recomputes the totals, and if they differ from `expected` it rolls back and returns `409 SETTLEMENT_STALE` with the fresh preview. Otherwise it commits, marks the settlement FINALIZED, and sets the tenancy CLOSED if both balances are zero (BR-015).

### 4.6 `POST {ws}/readings` (atomic reading + charge)
```json
{ "id": "…", "meter_id": "…", "reading_date": "2026-10-18", "value": "4951.500", "reading_type": "REGULAR",
  "replacement": null,
  "charge": { "id": "…", "tenancy_id": "…", "amount_minor": 208500, "due_date": "2026-10-22",
              "previous_reading_id": "…", "quantity": "219.500", "rate": "9.5000", "fixed_amount_minor": 0,
              "description": "Electricity 18 Sep–18 Oct: 219.5 kWh × ₹9.50" } }
```
With replacement: `"replacement": {"old_final_id": "…", "old_final_value": "8850.000", "new_start_id": "…", "new_start_value": "0.000"}` creates METER_END and METER_START readings on the same date. Validation: BR-017; `READING_DUPLICATE`; charge tenancy ACTIVE on that unit; `quantity` must equal the server-computed consumption (else 422); amount may be edited by the user.
