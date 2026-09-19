# 02 — Feature & Module Specification

```text
Version:      0.1
Status:       Draft — awaiting owner review
Last Updated: 2026-09-18
Depends On:   01_PRD.md
Affected By:  10_FINANCIAL_RULES.md, 11_SECURITY_AND_PRIVACY.md, 16_DECISION_LOG.md
```

## How to read this document

The product is split into modules. Each feature has a card with the 13 required attributes. Requirement IDs (e.g. `PAY-001`) refer to `01_PRD.md`. Roles and the permissions matrix are defined in `01_PRD.md` §12, and "Manager+" means Owner, Admin, or Manager with access to the property. Calculations are defined only in `10_FINANCIAL_RULES.md`; this document references them rather than restating them.

Common behaviour (applies to every feature unless stated):

- **Offline (Android):** every create/edit/void is saved locally at once, marked *pending*, and synced later (`08_SYNC_SPECIFICATION.md`). The website requires a connection.
- **Audit:** every write creates an audit event (`NFR-010`).
- **Validation:** both clients validate. The server re-validates everything and is final.
- **Money input:** amounts are typed in major units (e.g. 15000) and stored as integer minor units.

## Module index

| # | Module | Features |
|---|---|---|
| 1 | Authentication & Account | F-ACC-1…4 |
| 2 | User Management (workspace & team) | F-TEAM-1…4 |
| 3 | Dashboard | F-DASH-1 |
| 4 | Property Management | F-PROP-1…4 |
| 5 | Unit Management | F-UNIT-1…3 |
| 6 | Tenant Management | F-TEN-1…3 |
| 7 | Tenancy Management | F-TNCY-1…7 |
| 8 | Rent Management | F-RENT-1…5 |
| 9 | Payment Management | F-PAY-1…6 |
| 10 | Security Deposit | F-DEP-1…3 |
| 11 | Move-In | F-MIN-1…3 |
| 12 | Move-Out | F-MOUT-1…4 |
| 13 | Electricity/Utility Management | F-UTIL-1…3 |
| 14 | Expense Management | F-EXP-1 |
| 15 | Maintenance | (Future) |
| 16 | Documents | F-DOC-1…3 |
| 17 | Notifications | F-NOT-1…4 |
| 18 | Reports | F-REP-1…3 |
| 19 | Search & Filtering | F-SRCH-1…2 |
| 20 | Settings | F-SET-1…2 |
| 21 | Sync & Offline | F-SYNC-1 |
| 22 | Version 1 modules | F-V1-1…6 |

---

## 1. Authentication & Account

#### F-ACC-1 Sign in / sign up
Covers: ACC-001, ACC-002, ACC-003

| Attribute | Specification |
|---|---|
| Purpose | Let a user access their workspaces without managing a password. |
| Actors | Any user |
| Prerequisites | Internet connection (sign-in cannot happen offline). |
| Inputs | Google account (Android Credential Manager / web OAuth) or email address + 6-digit code. |
| Outputs | Authenticated session (access token ~1 h, refresh token); profile row created on first sign-in. |
| Business rules | Same email via Google or code = same user. First sign-in with no memberships → create-workspace screen (F-TEAM-1) unless a pending invite exists for the email. |
| Validations | Email format; code 6 digits, expires in 10 min, max 5 attempts; resend allowed after 60 s. |
| Permissions | Public. |
| Edge cases | User signs in on a second device (both sessions valid); Google account without email permission (reject with message); email changed at Google (identity is the Supabase user id). |
| Empty state | n/a |
| Failure state | "Couldn't send the code. Check the address and try again." / "That code is wrong or expired." / offline: "You need internet to sign in." |
| Success state | Lands on Home of the last-used workspace (or onboarding). |
| Dependencies | Supabase Auth, email provider (06). |

#### F-ACC-2 Profile and sessions
Covers: ACC-003, ACC-004

| Attribute | Specification |
|---|---|
| Purpose | Maintain name and contact details shown to teammates; control sessions. |
| Actors | Any user |
| Prerequisites | Signed in |
| Inputs | Full name (required, 1–100), phone (optional, E.164), locale. |
| Outputs | Updated profile; signed-out sessions. |
| Business rules | Email comes from the identity provider and is read-only here. "Sign out of all devices" revokes all refresh tokens; Android devices with pending changes keep them locally until the same user signs in again (SYNC-008). |
| Validations | Name not blank; phone valid for its country. |
| Permissions | Self only. |
| Edge cases | Sign-out on Android with pending changes → blocked with "N changes not synced yet" + options "Sync now" / "Sign out anyway (discard)". |
| Empty state | n/a |
| Failure state | Inline field errors; offline edits queue like any other change. |
| Success state | "Profile saved." |
| Dependencies | F-SYNC-1 |

#### F-ACC-3 App lock (Android)
Covers: ACC-007

| Attribute | Specification |
|---|---|
| Purpose | Protect on-device data (incl. ID photos) from someone holding an unlocked phone. |
| Actors | Android user |
| Prerequisites | Device has a screen lock. |
| Inputs | Toggle on/off. |
| Outputs | Lock screen on cold start and after 60 s in background. |
| Business rules | Uses the device's biometric or PIN (BiometricPrompt). The app never stores its own PIN. |
| Validations | If there is no device lock: "Set up a screen lock on your phone first." Toggle stays off. |
| Permissions | Self. |
| Edge cases | Biometric removed later → falls back to device credential. |
| Empty state | n/a |
| Failure state | Authentication cancelled → app stays locked. |
| Success state | Content visible. |
| Dependencies | None |

#### F-ACC-4 Delete account
Covers: ACC-005, TEAM-007

| Attribute | Specification |
|---|---|
| Purpose | Let users permanently delete their account (store policy + privacy law). |
| Actors | Any user |
| Prerequisites | Online; not the Owner of a workspace that has other active members (must transfer ownership or remove members first). |
| Inputs | Confirmation by typing "DELETE"; optional reason. |
| Outputs | Account scheduled for deletion; workspaces where the user is the only member are scheduled too; email confirmation. |
| Business rules | 30-day grace (BR-025): signing in during grace offers "Cancel deletion". After grace: profile anonymized, memberships removed, owned solo workspaces purged incl. files. |
| Validations | Blocks listed in prerequisites, with a link to Team. |
| Permissions | Self. |
| Edge cases | Pending Android changes → must sync or discard first; user is a member in other workspaces → only their membership is removed; audit events keep "Former member". |
| Empty state | n/a |
| Failure state | Explains exactly what blocks deletion. |
| Success state | Signed out, email "Your account will be deleted on <date>." |
| Dependencies | F-TEAM-3, F-REP-3 (export offered before deletion). |

---

## 2. User Management (workspace & team)

#### F-TEAM-1 Create and switch workspaces
Covers: TEAM-001, TEAM-002

| Attribute | Specification |
|---|---|
| Purpose | A workspace holds one landlord's or one agency's data; users may belong to several. |
| Actors | Any signed-in user |
| Prerequisites | Signed in, online (creation). |
| Inputs | Name (e.g. "Sharma Properties"), country (sets locale defaults), default currency (prefilled from country), time zone (prefilled from device). |
| Outputs | Workspace, Owner membership, counters row. |
| Business rules | Creator = Owner. Default settings: rounding to whole units on, receipt prefix "R-", digest 09:00. |
| Validations | Name 2–80 chars; valid ISO country, currency, IANA time zone. |
| Permissions | Any user can create workspaces (limit 5 per user in beta, anti-abuse). |
| Edge cases | Switching workspace on Android while changes are pending → allowed; each workspace has its own outbox and cursor. |
| Empty state | Workspace switcher shows only the current one plus "Create workspace". |
| Failure state | Validation messages; offline: "Connect to create a workspace." |
| Success state | Onboarding checklist (SCR-06). |
| Dependencies | F-ACC-1 |

#### F-TEAM-2 Invite member
Covers: TEAM-003, TEAM-004

| Attribute | Specification |
|---|---|
| Purpose | Share records with co-owners, partners, managers and accountants. |
| Actors | Owner, Admin |
| Prerequisites | Online. |
| Inputs | Email, role (Admin/Manager/Viewer), access: all properties or selected properties, optional message. |
| Outputs | Membership in INVITED state; email with link valid 7 days. |
| Business rules | Invite is bound to the email (case-insensitive). Accepting with a different email is refused. Owner/Admin always have all properties. One active membership per user per workspace. |
| Validations | Valid email; not already a member; at least one property when "selected properties". |
| Permissions | Owner, Admin (Admin cannot invite an Owner). |
| Edge cases | Invitee has no account → signs up via link; invite resent → new token, old invalid; property later archived → access list keeps it (read-only). |
| Empty state | Team screen: "Only you have access. Invite a co-owner or manager." |
| Failure state | "This person is already a member." / "Invite expired — ask for a new one." |
| Success state | Member listed as "Invited"; becomes "Active" on acceptance (notification to inviter). |
| Dependencies | Email provider, F-NOT-3 |

#### F-TEAM-3 Change role, revoke access, transfer ownership
Covers: TEAM-005, TEAM-007

| Attribute | Specification |
|---|---|
| Purpose | Keep access current as people join and leave. |
| Actors | Owner, Admin (ownership transfer: Owner only) |
| Prerequisites | Online. |
| Inputs | New role / property list / revoke confirmation / new Owner (must be an active Admin). |
| Outputs | Updated membership; affected member's devices resync or wipe their local copy. |
| Business rules | Exactly one Owner. Transfer makes the old Owner an Admin. Revocation: next request/sync returns 403, Android wipes that workspace's local data after informing the user. Pending changes of a revoked member are rejected (FORBIDDEN) and listed in their sync issues. |
| Validations | Cannot remove or demote the Owner; Admin cannot change another Admin's role to Owner. |
| Permissions | Owner, Admin (not on the Owner). |
| Edge cases | Scoped manager loses access to one property → full resync removes it locally. |
| Empty state | n/a |
| Failure state | Clear message for each validation. |
| Success state | "Access updated." |
| Dependencies | F-SYNC-1 (access change handling, 08 §11) |

#### F-TEAM-4 Audit log
Covers: TEAM-006

| Attribute | Specification |
|---|---|
| Purpose | Answer "who changed this, when, from which device". |
| Actors | Owner, Admin (website) |
| Prerequisites | Online. |
| Inputs | Filters: entity type/id, member, action, date range. |
| Outputs | List: time, member, source (web/android/job), action, entity, changed fields (before → after). |
| Business rules | Append-only; entries are never edited; retained for the workspace lifetime. |
| Validations | Date range ≤ 1 year per query. |
| Permissions | Owner, Admin. |
| Edge cases | Deleted user → "Former member"; job actions → "System". |
| Empty state | "No activity for these filters." |
| Failure state | Standard error banner with retry. |
| Success state | Paginated list. |
| Dependencies | Audit events written by every command (05, 07). |

---

## 3. Dashboard

#### F-DASH-1 Home dashboard
Covers: REP-001

| Attribute | Specification |
|---|---|
| Purpose | Show this month's collection status and what needs attention, in one screen. |
| Actors | All roles (scoped to accessible properties) |
| Prerequisites | Workspace has data; Android works from local data. |
| Inputs | Month (default current), property filter (persistent), currency (only if > 1 currency in view). |
| Outputs | Metrics (billed, collected, collection rate, outstanding, overdue, advances, deposits held, expenses, net cash, occupancy) and lists (needs attention/overdue, due in 7 days, paid this month, move-outs ≤ 30 days, lease ends ≤ 30 days). Definitions in `13_REPORTING_SPECIFICATION.md` §2. |
| Business rules | Money totals are never mixed across currencies. Deposits are excluded from collected and net cash. Offline Android shows "As of last sync <time>". |
| Validations | n/a |
| Permissions | All roles; Viewer sees no "Record payment" buttons. |
| Edge cases | New workspace (see empty state); months before the first tenancy show zeros; archived properties excluded unless the filter selects them explicitly. |
| Empty state | Onboarding checklist: 1 Add a property → 2 Add units → 3 Add a tenancy, each with a button. |
| Failure state | Web: error banner with retry; Android: cached data + sync status. |
| Success state | Metrics and lists; each list row has "Record payment" and "Remind" actions. |
| Dependencies | F-RENT-5, F-PAY-1, 13 |

---

## 4. Property Management

#### F-PROP-1 Create / edit property
Covers: PROP-001, PROP-002

| Attribute | Specification |
|---|---|
| Purpose | Register each building/house the workspace manages. |
| Actors | Owner, Admin, Manager with all-properties access (edit: Manager scoped) |
| Prerequisites | Workspace exists. |
| Inputs | Name*, type*, address lines, city, region, postal code, country* (default workspace), currency* (default workspace), notes, photo, payment-instructions override (F-PAY-5). |
| Outputs | Property; for type "independent house" also one unit labelled "Main". |
| Business rules | Currency locked once a tenancy exists (BR-003). Names unique per workspace (case-insensitive). |
| Validations | Name 1–100; valid country and currency codes. |
| Permissions | See matrix. |
| Edge cases | Two properties with same address but different names (allowed); changing currency before any tenancy updates meters and expenses of that property only if none exist; otherwise blocked with CURRENCY_LOCKED. |
| Empty state | Properties list: "No properties yet. Add your first building or house." |
| Failure state | Inline errors; duplicate name → "A property with this name already exists." |
| Success state | Property detail opens with "Add units" prompt. |
| Dependencies | F-UNIT-1 |

#### F-PROP-2 Owners and shares
Covers: OWN-001

| Attribute | Specification |
|---|---|
| Purpose | Record who owns each property and in what share (co-ownership; managed properties). |
| Actors | Owner, Admin, Manager (scoped) |
| Prerequisites | Property exists. |
| Inputs | Owner records (name*, phone, email, address, notes) chosen or created; share % per owner. |
| Outputs | Property–owner links with share in basis points (100% = 10000). |
| Business rules | If one owner: 100%. If more: shares must sum to exactly 100.00%. Owner records are reusable across properties. An owner can optionally be invited as a Viewer scoped to their properties (F-TEAM-2). |
| Validations | Share 0.01–100.00 with 2 decimals; sum check. |
| Permissions | See matrix. |
| Edge cases | No owners listed → workspace is the implied owner; owner deleted while linked → blocked (remove links first). |
| Empty state | "No owners recorded. Add owners to track co-ownership." |
| Failure state | "Shares add up to 90%. They must total 100%." |
| Success state | Owners with shares shown on property detail. |
| Dependencies | OWN-002 (V1 owner statements) |

#### F-PROP-3 Archive / delete property
Covers: PROP-003, PROP-004

| Attribute | Specification |
|---|---|
| Purpose | Remove sold or no-longer-managed properties from daily view without losing history. |
| Actors | Owner, Admin |
| Prerequisites | Archive: no ACTIVE tenancy. Delete: no tenancies, ledger entries, meters, readings, expenses, documents. |
| Inputs | Confirmation. |
| Outputs | `archived_at` set (and its units archived), or hard delete. |
| Business rules | Archived properties are excluded from dashboards, pickers and billing counts; reports can include them by filter. Unarchive restores units. |
| Validations | Prerequisites checked on server (HAS_DEPENDENCIES / TENANCY_ACTIVE). |
| Permissions | Owner, Admin. |
| Edge cases | Offline archive conflicts with a tenancy started on the web → server rejects archive; sync issue explains. |
| Empty state | Archived list: "Nothing archived." |
| Failure state | "End or move the 3 active tenancies before archiving." |
| Success state | "Property archived. Find it under Archived." |
| Dependencies | F-MOUT-3 |

#### F-PROP-4 Property list and detail
Covers: PROP-005

| Attribute | Specification |
|---|---|
| Purpose | Navigate a large portfolio quickly. |
| Actors | All roles (scoped) |
| Prerequisites | — |
| Inputs | Search text, filters (type, archived), sort (name, outstanding, occupancy). |
| Outputs | List rows: name, city, units occupied/total, outstanding now (per currency). Detail: units grid with status chips, owners, meters, documents, month summary, expenses. |
| Business rules | Outstanding per `13` §2. |
| Validations | n/a |
| Permissions | All roles. |
| Edge cases | 300+ properties → list virtualized; property without units shows "Add units". |
| Empty state | "No properties yet." + Add button (hidden for Viewer). |
| Failure state | Standard. |
| Success state | — |
| Dependencies | F-UNIT-2 |

---

## 5. Unit Management

#### F-UNIT-1 Add units (single and bulk)
Covers: UNIT-001, UNIT-002

| Attribute | Specification |
|---|---|
| Purpose | Create all rentable spaces quickly, even for buildings with many rooms. |
| Actors | Owner, Admin, Manager (scoped) |
| Prerequisites | Property exists. |
| Inputs | Single: label*, type*, floor/block, area + unit (sq ft / m²), default rent, default deposit, notes. Bulk: count (1–200), pattern with `{n}` (e.g. "Room {n}"), start number, step, type, floor/block, default rent/deposit. |
| Outputs | Units; bulk shows a preview list before saving. |
| Business rules | Labels unique per property, case-insensitive (BR-004). Bulk creation is one operation (all or nothing). |
| Validations | Label 1–40; pattern contains `{n}`; generated labels must not collide with existing ones (preview marks collisions). |
| Permissions | See matrix. |
| Edge cases | Bulk with 0 collisions but offline duplicate created on another device → server rejects the whole bulk op; user edits labels. |
| Empty state | Property detail: "No units yet. Add one or add many at once." |
| Failure state | "Room 104 already exists." |
| Success state | Units grid shows new units as Vacant. |
| Dependencies | F-PROP-1 |

#### F-UNIT-2 Unit status and detail
Covers: UNIT-003, UNIT-005

| Attribute | Specification |
|---|---|
| Purpose | See whether a unit is earning and its history. |
| Actors | All roles (scoped) |
| Prerequisites | — |
| Inputs | — |
| Outputs | Status (derived, `04` §4.4), current tenancy summary, meters with last reading, past tenancies, documents. |
| Business rules | Vacant = no tenancy occupying today; Upcoming = tenancy starting in future; On notice = active with planned move-out. |
| Validations | n/a |
| Permissions | All roles. |
| Edge cases | Unit vacant today with future tenancy → both "Vacant" and "Upcoming <date>". |
| Empty state | "Vacant since <date>. Start a tenancy." |
| Failure state | Standard. |
| Success state | — |
| Dependencies | F-TNCY-1 |

#### F-UNIT-3 Archive / delete unit
Covers: UNIT-004

| Attribute | Specification |
|---|---|
| Purpose | Retire units that no longer exist (merged rooms, demolished). |
| Actors | Owner, Admin, Manager (scoped) |
| Prerequisites | Archive: no ACTIVE tenancy. Delete: never had a tenancy, meter or document. |
| Inputs | Confirmation. |
| Outputs | Archived or deleted unit. |
| Business rules | Archived units are excluded from occupancy and vacancy. |
| Validations | Server-side checks (HAS_DEPENDENCIES, TENANCY_ACTIVE). |
| Permissions | See matrix. |
| Edge cases | Unit with upcoming tenancy → archive blocked. |
| Empty state | n/a |
| Failure state | Message naming the blocking tenancy. |
| Success state | "Unit archived." |
| Dependencies | — |

---

## 6. Tenant Management

#### F-TEN-1 Create / edit tenant
Covers: TENANT-001, TENANT-002, TENANT-005

| Attribute | Specification |
|---|---|
| Purpose | Keep one record per person or company, reused across tenancies. |
| Actors | Owner, Admin, Manager |
| Prerequisites | — |
| Inputs | Kind (individual/company)*, full name*, phone (E.164), alternate phone, email, permanent address, emergency contact name/phone, ID type, ID last 4 characters, notes, photo; documents via F-DOC-1. |
| Outputs | Tenant record. |
| Business rules | Full ID numbers are never stored (D-025). Duplicate check on phone/email within the workspace → warning with link to the existing tenant (not a block). |
| Validations | Name 1–120; at least one of phone/email recommended (warning, not required); phone valid for its country; ID last 4 = 1–4 alphanumerics. |
| Permissions | See matrix (Manager may create tenants; scoped managers see tenants linked to their properties and tenants they created). |
| Edge cases | Tenant with no phone (allowed; reminders disabled); company tenant with contact person (use notes + co-tenant for the person). |
| Empty state | Tenants list: "No tenants yet. Tenants are added when you start a tenancy." |
| Failure state | Inline errors. |
| Success state | Tenant detail. |
| Dependencies | F-DOC-1 |

#### F-TEN-2 Tenant list and detail
Covers: TENANT-003, TENANT-004

| Attribute | Specification |
|---|---|
| Purpose | Find a tenant and see everything about them. |
| Actors | All roles (scoped) |
| Prerequisites | — |
| Inputs | Filter Current/Former/All, search, sort (name, balance). |
| Outputs | Rows: name, unit(s), balance now, status chip. Detail: contact actions (call, WhatsApp `wa.me`, SMS, email), tenancies with balances, documents, notes. |
| Business rules | Current = has ACTIVE tenancy; Former = only ENDED/CLOSED; others (no tenancy yet) listed under All. |
| Validations | n/a |
| Permissions | All roles; Viewer sees contact details but no sensitive documents. |
| Edge cases | Tenant with tenancies in two properties, user scoped to one → sees only that tenancy. |
| Empty state | As F-TEN-1. |
| Failure state | Standard. |
| Success state | — |
| Dependencies | — |

#### F-TEN-3 Archive / delete tenant
Covers: TENANT-006

| Attribute | Specification |
|---|---|
| Purpose | Tidy lists without losing history. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Archive: no ACTIVE tenancy. Delete: never part of a tenancy. |
| Inputs | Confirmation. |
| Outputs | Archived/deleted tenant (documents soft-deleted with the tenant). |
| Business rules | Archived tenants appear under Former/All with an Archived chip. |
| Validations | Server checks. |
| Permissions | See matrix. |
| Edge cases | Deleting tenant with documents → documents soft-deleted (30-day purge). |
| Empty state | n/a |
| Failure state | "This tenant has a tenancy. Archive instead." |
| Success state | "Tenant archived." |
| Dependencies | — |

---

## 7. Tenancy Management

#### F-TNCY-1 Start a new tenancy (move-in)
Covers: TENANCY-001, TENANCY-003, TENANCY-004, TENANCY-005, MOVEIN-003, DEP-001, RENT-002, RENT-009

| Attribute | Specification |
|---|---|
| Purpose | Record the rental agreement and everything captured at move-in, in one guided flow. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Unit exists and has no overlapping tenancy (BR-005). |
| Inputs | Step 1 Unit & people: unit*, primary tenant* (pick or create), co-tenants/occupants. Step 2 Terms: move-in date*, lease end date, rent*, cycle day* (default 1; option "same as move-in day" ≤ 28), grace days* (default 4, "due by the 5th"), notice period days, recurring monthly charges (label, category, amount). Step 3 Deposit & move-in charges: deposit agreed (default unit default), other one-time charges (e.g. agreement fee). Step 4 Meters: opening readings (F-MIN-2). Step 5 Inspection (F-MIN-1, may be skipped and completed later). Step 6 Documents (agreement, IDs). Step 7 Review: proposed charges (F-MIN-3), editable. |
| Outputs | Tenancy (ACTIVE), parties, first rent revision, recurring charge definitions, charges for all periods starting on or before today, deposit charge, opening readings, inspection, documents. Optional next step "Collect payment now" (F-PAY-1). |
| Business rules | Saved as **one atomic operation** (`tenancy.start`, 08 §6). Periods starting before today are included (backdated move-in). Charge generation after this is server-side (F-RENT-1). Future-dated move-in shows the unit as Upcoming. |
| Validations | Move-in date ≤ today + 365 days; lease end > move-in; rent > 0; cycle day 1–28; grace 0–60; deposit ≥ 0; exactly one primary tenant; readings valid per F-UTIL-2. |
| Permissions | Owner, Admin, Manager (scoped). |
| Edge cases | Unit occupied on those dates (UNIT_OCCUPIED, show conflicting tenancy); new tenant replacing someone on notice (allowed if dates don't overlap); tenant already renting another unit (allowed); move-in on the 29th–31st with "same as move-in day" → cycle day 28 suggested; backdated 3 months → 3–4 charges proposed. |
| Empty state | n/a |
| Failure state | Step-level validation; server rejection shows the reason and keeps the draft. |
| Success state | Tenancy detail with ledger; snackbar "Tenancy started. Record the deposit?" |
| Dependencies | F-TEN-1, F-MIN-1…3, F-RENT-1, 10 §4–5 |

#### F-TNCY-2 Add an existing tenancy (digitize)
Covers: TENANCY-002

| Attribute | Specification |
|---|---|
| Purpose | Bring tenants who were already renting before the app, without typing years of history. |
| Actors | Owner, Admin, Manager |
| Prerequisites | As F-TNCY-1. |
| Inputs | Unit, parties, original start date (informational, used for occupancy), billing start date* (a cycle start, usually this or next month), current rent, cycle day, grace, lease end, notice period, recurring charges, opening balance: arrears amount or advance amount as of billing start, deposit agreed and deposit already held, baseline meter readings (last known value + date), documents. |
| Outputs | Tenancy with `billing_start_date`; OPENING_BALANCE charge (arrears) or OPENING_ADVANCE credit; deposit charge + deposit payment (method OPENING_BALANCE, no receipt) for the amount held; baseline readings; charges from billing start to today. |
| Business rules | No charges before billing start. Opening entries are ordinary ledger entries (auditable, voidable). `10` §9. |
| Validations | Billing start must be a cycle start date ≥ original start; deposit held ≤ deposit agreed (warning if less, block if more); arrears and advance are mutually exclusive. |
| Permissions | Owner, Admin, Manager (scoped). |
| Edge cases | Tenant owes 2 months + electricity → one opening arrears amount with a note; deposit partly collected → held < agreed shows "Deposit due" balance. |
| Empty state | n/a |
| Failure state | As F-TNCY-1. |
| Success state | Tenancy detail showing opening balance as the first ledger line. |
| Dependencies | F-TNCY-1 |

#### F-TNCY-3 Manage tenancy parties
Covers: TENANCY-004

| Attribute | Specification |
|---|---|
| Purpose | Add or remove co-tenants and occupants; change the primary tenant. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy ACTIVE or ENDED. |
| Inputs | Tenant, role (primary/co-tenant/occupant), joined/left dates. |
| Outputs | Updated parties. |
| Business rules | Exactly one current primary; making someone primary demotes the old primary to co-tenant. Removing = set left date (history kept). |
| Validations | Cannot remove the primary without choosing a new one. |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Co-tenant is also primary tenant elsewhere (allowed). |
| Empty state | "No co-tenants." |
| Failure state | "Choose a new primary tenant first." |
| Success state | Parties list updated. |
| Dependencies | — |

#### F-TNCY-4 Change rent (rent revision)
Covers: TENANCY-006

| Attribute | Specification |
|---|---|
| Purpose | Record increases/decreases from a given period. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy ACTIVE. |
| Inputs | New rent*, effective from* (picker shows period start dates only), reason. |
| Outputs | Rent revision; future charges use the new amount; if effective date is in the past, proposed adjustment entries (one per already-charged period) for confirmation. |
| Business rules | BR-024; `10` §7. |
| Validations | Rent > 0; effective date is a period start ≥ billing start; no other revision on the same date (REVISION_EXISTS). |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Two devices add revisions for the same date offline → second rejected; revision dated after planned move-out (warning). |
| Empty state | Rent history shows the initial rent only. |
| Failure state | Inline errors. |
| Success state | "Rent changes to ₹16,500 from 1 Oct 2026." Schedule preview updated. |
| Dependencies | F-RENT-1 |

#### F-TNCY-5 Lease end and renewal
Covers: TENANCY-007

| Attribute | Specification |
|---|---|
| Purpose | Track agreement expiry and renewals. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy ACTIVE. |
| Inputs | New lease end date (or clear), optional new agreement document, optional rent revision. |
| Outputs | Updated tenancy. |
| Business rules | Passing the lease end date does not end the tenancy; it is flagged "Lease expired" and included in the digest. |
| Validations | Lease end > move-in. |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Lease end before planned move-out (allowed, warning). |
| Empty state | "No lease end date (open-ended)." |
| Failure state | Inline. |
| Success state | "Lease extended to 31 Aug 2027." |
| Dependencies | F-NOT-1 |

#### F-TNCY-6 Cancel a tenancy
Covers: TENANCY-008

| Attribute | Specification |
|---|---|
| Purpose | Undo a tenancy created by mistake (wrong unit or tenant). |
| Actors | Owner, Admin, Manager (Manager only if no money entries other than charges) |
| Prerequisites | No active payments, refunds or deposit applications on it. |
| Inputs | Reason*. |
| Outputs | Status CANCELLED; all its active charges and credits voided with reason "Tenancy cancelled"; unit freed. |
| Business rules | Cancelled tenancies are excluded from occupancy, reports and overlap checks, and are kept for audit. |
| Validations | Server check (TENANCY_HAS_PAYMENTS). |
| Permissions | See above. |
| Edge cases | Payments exist → user must void them first (each with reason) or end the tenancy normally. |
| Empty state | n/a |
| Failure state | "Void the 2 payments first or end the tenancy instead." |
| Success state | "Tenancy cancelled." |
| Dependencies | F-PAY-2 |

#### F-TNCY-7 Tenancy detail
Covers: TENANCY-009

| Attribute | Specification |
|---|---|
| Purpose | One place for everything about an agreement. |
| Actors | All roles (scoped) |
| Prerequisites | — |
| Inputs | Tab selection, ledger filter (all/charges/payments). |
| Outputs | Header: unit, tenants, rent, next due date, balance now (owed/advance), overdue, deposit held/due. Tabs: Ledger (newest first, running balance, status chips, voided lines struck through), Details (terms, parties, rent history, recurring charges, schedule preview), Utilities (meters, readings), Documents, Inspections, Activity (audit for this tenancy). Actions: Record payment, Add charge, Add credit, Refund, Remind, Share statement, Change rent, Give notice, Move out, Cancel. |
| Business rules | Figures per `10`. Actions hidden per role and state (e.g. CLOSED → read-only banner "Closed on …, reopen settlement to change"). |
| Validations | n/a |
| Permissions | All roles (actions per matrix). |
| Edge cases | Pending (unsynced) entries show a clock icon; failed ones a warning icon linking to sync issues. |
| Empty state | Ledger: "No entries yet." |
| Failure state | Standard. |
| Success state | — |
| Dependencies | Most modules |

---

## 8. Rent Management

#### F-RENT-1 Automatic rent and recurring charges
Covers: RENT-001, RENT-009

| Attribute | Specification |
|---|---|
| Purpose | Bill every tenancy every month without manual work. |
| Actors | System (hourly job) |
| Prerequisites | Tenancy ACTIVE; billing start ≤ today. |
| Inputs | Tenancy terms, rent revisions, recurring charge definitions, workspace time zone. |
| Outputs | For each missing period start ≤ today: one RENT charge (+ one charge per applicable recurring definition), with period, due date and description (e.g. "Rent · Oct 2026"). |
| Business rules | `10` §4–6. Idempotent through a unique generated key per tenancy/period/type; a voided generated charge is never re-created. Stops for periods starting after move-out or planned move-out. Not generated on devices (D-023); offline devices see new charges after syncing. |
| Validations | n/a (system). |
| Permissions | System; results visible per scope. |
| Edge cases | Job down for 2 days → catches up; tenancy moved out mid-period → last period generated in full, proration handled in settlement; rent revision effective this period → new amount used. |
| Empty state | n/a |
| Failure state | Job failure alerts the developer (NFR-013); next run catches up. |
| Success state | Charges appear in ledgers and dashboard. |
| Dependencies | 06 (jobs), 10 |

#### F-RENT-2 Manual charges
Covers: RENT-003, UTIL-005

| Attribute | Specification |
|---|---|
| Purpose | Bill anything else: electricity bill amounts, repairs, cleaning, late fees, tax, other. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy ACTIVE or ENDED (not CLOSED/CANCELLED). |
| Inputs | Category*, description*, amount*, date* (default today), due date* (default date + grace), optional period, proof/bill photo. |
| Outputs | Charge on the rent account (deposit charges only via F-DEP-2). |
| Business rules | Immutable once saved (BR-009). |
| Validations | Amount > 0 and ≤ 10^12 minor units; due date ≥ date. |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Charge dated before tenancy start (allowed ≥ start − 365 days, e.g. booking fee). |
| Empty state | n/a |
| Failure state | Inline; CLOSED → TENANCY_CLOSED. |
| Success state | Ledger line added; balance updated immediately (locally). |
| Dependencies | F-DOC-1 |

#### F-RENT-3 Credits (discount, waiver, adjustment, write-off)
Covers: RENT-006

| Attribute | Specification |
|---|---|
| Purpose | Reduce what a tenant owes without a payment (rent-free month, goodwill discount, bad debt). |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy not CLOSED/CANCELLED. |
| Inputs | Category* (discount, waiver, adjustment, write-off), amount*, date*, reason*. |
| Outputs | Credit entry on rent account; FIFO recalculated. |
| Business rules | Credits behave like payments in FIFO but are not money received: excluded from "collected". |
| Validations | Amount > 0; reason 3–500 chars. |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Credit larger than balance → becomes advance credit (warning shown). |
| Empty state | n/a |
| Failure state | Inline. |
| Success state | Ledger line "Waiver — first month free −₹15,000". |
| Dependencies | — |

#### F-RENT-4 Void a charge or credit
Covers: RENT-004

| Attribute | Specification |
|---|---|
| Purpose | Correct mistakes while keeping the audit trail. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Entry ACTIVE; tenancy not CLOSED. |
| Inputs | Reason* (preset: entered in error, duplicate, amount wrong, other + text). |
| Outputs | Entry status VOID, voided by/at/reason; FIFO recalculated. Option "Void and re-enter" opens a prefilled form. |
| Business rules | Voids are final; to reverse a void, enter a new entry. Settlement entries can only be voided by reopening the settlement. |
| Validations | Server: entry not part of a finalized settlement (use F-MOUT-4). |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Voiding a generated rent charge → the job will not re-create it (to re-bill, add a manual rent charge). Double void from two devices → second is a no-op success. |
| Empty state | n/a |
| Failure state | "This entry belongs to a settlement. Reopen the settlement to change it." |
| Success state | Line struck through with "Voided: reason". |
| Dependencies | — |

#### F-RENT-5 Charge status and schedule
Covers: RENT-005, RENT-007

| Attribute | Specification |
|---|---|
| Purpose | Show clearly what is paid, partly paid, unpaid and overdue, and what is coming. |
| Actors | All roles |
| Prerequisites | — |
| Inputs | Ledger entries. |
| Outputs | Per charge: paid amount, remaining, status chip (Paid / Partly paid ₹x left / Unpaid) + Overdue chip; schedule of next 12 periods with dates and amounts (rent + recurring). |
| Business rules | `10` §3 (FIFO). Overdue = remaining > 0 and due date < today (workspace time zone). |
| Validations | n/a |
| Permissions | All roles. |
| Edge cases | Advance credit covers future charges → they show Paid when generated. |
| Empty state | n/a |
| Failure state | n/a (computed locally and on server). |
| Success state | — |
| Dependencies | 10 |

---

## 9. Payment Management

#### F-PAY-1 Record a payment
Covers: PAY-001, PAY-002, PAY-003, PAY-006

| Attribute | Specification |
|---|---|
| Purpose | Log money received from a tenant, in the fewest taps. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy not CLOSED/CANCELLED. |
| Inputs | Tenancy* (preselected from context), towards rent & charges amount and/or towards deposit amount (both prefilled: rent due now; deposit due), date* (today), method* (default: last used by this user), reference (shown for non-cash), note, proof photos. |
| Outputs | One payment entry per non-zero amount (rent account, deposit account); allocation preview; receipt number after server acceptance. |
| Business rules | FIFO (`10` §3); excess → advance credit. Possible duplicate (PAY-006) → warning dialog before save when detectable locally, and a server flag if detected on sync. |
| Validations | Each amount ≥ 0, at least one > 0, ≤ 10^12 minor; deposit amount ≤ deposit due (DEPOSIT_EXCEEDS_DUE, which prevents recording the same deposit twice; to collect more, increase the deposit first, F-DEP-2); date ≤ today + 1 and ≥ tenancy start − 365 days (BR-021). |
| Permissions | Owner, Admin, Manager (Staff in V1). |
| Edge cases | Paying 2 months at once (FIFO covers both); paying before the charge exists (advance, auto-applied later); paying offline on the 1st before the month's charge is synced (shows as advance until sync); cash handed to a staff member (record, method cash, note). |
| Empty state | n/a |
| Failure state | Inline errors; server rejection (e.g. TENANCY_CLOSED) → sync issue with actions. |
| Success state | Sheet closes; row updates to Paid with a short check animation; snackbar "₹15,000 recorded · Share receipt" (receipt enabled after sync). |
| Dependencies | F-PAY-3, 08 |

#### F-PAY-2 Void a payment
Covers: PAY-004

| Attribute | Specification |
|---|---|
| Purpose | Handle bounced cheques and wrong entries. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Payment ACTIVE; tenancy not CLOSED; for deposit payments, voiding must not make deposit held negative. |
| Inputs | Reason* (cheque bounced, entered in error, duplicate, other). |
| Outputs | Payment VOID; receipt marked VOID; FIFO recomputed; optional follow-up "Add bounce fee" charge. |
| Business rules | Receipt number is not reused (BR-018). |
| Validations | DEPOSIT_INSUFFICIENT if deposit already applied/refunded. |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Unsynced payment voided before it was ever sent → the pending create is simply removed (no trace, `08` §9.4). |
| Empty state | n/a |
| Failure state | Explains blocking reason. |
| Success state | Payment struck through; balance increases. |
| Dependencies | F-RENT-4 |

#### F-PAY-3 Receipt
Covers: PAY-005

| Attribute | Specification |
|---|---|
| Purpose | Give tenants proof of payment. |
| Actors | Owner, Admin, Manager (Viewer: view only) |
| Prerequisites | Payment accepted by server (has receipt number). |
| Inputs | — |
| Outputs | PDF: landlord details, receipt no., date, received from (primary tenant), unit and property, amount, account (rent & charges / security deposit), method, reference, note, recorded by; VOID watermark if voided. Share via WhatsApp/email/share sheet. |
| Business rules | Receipt numbers sequential per workspace: `<prefix><000123>`. Opening-balance and internal-transfer payments have no receipt. |
| Validations | n/a |
| Permissions | As above. |
| Edge cases | Offline → button disabled "Available after sync"; landlord details missing → receipt still generated with workspace name. |
| Empty state | n/a |
| Failure state | "Couldn't create the receipt. Try again." |
| Success state | Share sheet opens with PDF + prefilled message (12 §5). |
| Dependencies | PDF generation (06) |

#### F-PAY-4 Refund advance credit
Covers: PAY-007

| Attribute | Specification |
|---|---|
| Purpose | Record money returned to a tenant who overpaid. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Rent balance negative (advance). |
| Inputs | Amount*, date*, method*, reference, note. |
| Outputs | REFUND entry on rent account. |
| Business rules | BR-014. Deposit refunds are in F-DEP-3. |
| Validations | Amount ≤ advance credit (REFUND_EXCEEDS_CREDIT). |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Two devices refund the same advance offline → second rejected by server. |
| Empty state | n/a |
| Failure state | Inline + sync issue. |
| Success state | Balance returns toward zero. |
| Dependencies | — |

#### F-PAY-5 Payment instructions
Covers: PAY-008

| Attribute | Specification |
|---|---|
| Purpose | Tell tenants how to pay (UPI ID, bank account, QR, link). |
| Actors | Owner, Admin |
| Prerequisites | — |
| Inputs | Free-text bank details, UPI ID / payment handle, payment link URL, QR image (document category PAYMENT_QR). Per-property override uses the same fields. |
| Outputs | Instructions used in reminders and (V1) tenant portal/chat. |
| Business rules | Property override replaces the workspace default entirely. These are displayed, never processed. |
| Validations | URL must be https; text ≤ 500 chars; QR image ≤ 2 MB. |
| Permissions | Owner, Admin. |
| Edge cases | No instructions set → reminder omits the payment section. |
| Empty state | "Add how tenants should pay you." |
| Failure state | Inline. |
| Success state | Preview of the reminder text. |
| Dependencies | F-PAY-6 |

#### F-PAY-6 Send a reminder
Covers: PAY-009

| Attribute | Specification |
|---|---|
| Purpose | Ask for rent politely and consistently, with payment details. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenant has a phone (WhatsApp/SMS) or email. |
| Inputs | Template (12 §5), editable text; channel: WhatsApp (`https://wa.me/<phone>?text=`), SMS (`sms:`), email (`mailto:`), share sheet; optional QR image attachment (share sheet only). |
| Outputs | Opens the chosen app with the message; a "Reminder sent" activity note is stored on the tenancy (manual, since the app cannot confirm delivery). |
| Business rules | The app never sends messages itself (MVP). |
| Validations | Phone in E.164 for WhatsApp links. |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Multiple tenants → sends to the primary; co-tenants selectable. |
| Empty state | n/a |
| Failure state | "WhatsApp isn't installed." → fallback to share sheet. |
| Success state | Returns to app with "Reminder noted." |
| Dependencies | F-PAY-5, 12 |

---

## 10. Security Deposit

#### F-DEP-1 Deposit collection and held amount
Covers: DEP-001, DEP-002

| Attribute | Specification |
|---|---|
| Purpose | Track deposit agreed, collected (possibly in parts) and held. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy with deposit agreed > 0. |
| Inputs | Deposit payments via F-PAY-1 ("towards deposit"). |
| Outputs | Deposit due, held, applied, refunded (per `10` §8); deposit register (13 §8). |
| Business rules | Deposit account is separate from rent account; deposit payments never pay rent and rent payments never fill the deposit. |
| Validations | See F-PAY-1. |
| Permissions | See matrix. |
| Edge cases | Deposit collected before move-in date (allowed ≤ 365 days before). |
| Empty state | "No deposit agreed." |
| Failure state | n/a |
| Success state | Header shows "Deposit held ₹30,000". |
| Dependencies | F-PAY-1 |

#### F-DEP-2 Change the deposit
Covers: DEP-003

| Attribute | Specification |
|---|---|
| Purpose | Handle deposit increases (with rent increase) or reductions. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy ACTIVE. |
| Inputs | Increase: amount + reason (creates DEPOSIT charge). Reduce: amount + reason (creates DEPOSIT-account CREDIT if not yet collected; if collected, use deposit refund F-DEP-3). |
| Outputs | Updated deposit figures. |
| Business rules | `10` §8. |
| Validations | Reduction ≤ deposit due. |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Reduction after full collection → the UI routes to refund. |
| Empty state | n/a |
| Failure state | Inline. |
| Success state | "Deposit increased to ₹35,000 (₹5,000 due)." |
| Dependencies | — |

#### F-DEP-3 Apply or refund the deposit
Covers: DEP-004, DEP-005

| Attribute | Specification |
|---|---|
| Purpose | Use the deposit against dues, or return it. Normally done inside settlement, also available alone (e.g. tenant asks to adjust last month's rent against the deposit). |
| Actors | Owner, Admin, Manager |
| Prerequisites | Deposit held > 0. |
| Inputs | Apply: amount*, date*, reason*. Refund: amount*, date*, method*, reference. |
| Outputs | DEPOSIT_APPLIED entry (reduces held and rent balance) or deposit REFUND entry. |
| Business rules | BR-012, BR-013. |
| Validations | Apply ≤ min(held, positive rent balance); refund ≤ held (DEPOSIT_INSUFFICIENT / APPLY_EXCEEDS_BALANCE). |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Concurrent apply on two devices → server rejects the one that breaks the rule. |
| Empty state | n/a |
| Failure state | Inline + sync issue. |
| Success state | Figures updated. |
| Dependencies | F-MOUT-3 |

---

## 11. Move-In

#### F-MIN-1 Move-in inspection
Covers: MOVEIN-001

| Attribute | Specification |
|---|---|
| Purpose | Record the unit's condition at handover to avoid move-out disputes. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy exists (or inside the start wizard). |
| Inputs | Date, keys handed over (count), items grouped by area (default template by unit type, editable: add/remove items), condition per item (good, fair, damaged, missing, n/a), note, photos per item or area. |
| Outputs | Inspection (kind MOVE_IN) with items and photos; can be completed later. |
| Business rules | One move-in inspection per tenancy. Editable until the tenancy ends; changes audited. |
| Validations | Item names 1–80 chars; ≤ 200 items. |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Inspection skipped → reminder chip on tenancy "Move-in inspection not done". |
| Empty state | Template items shown with no conditions set. |
| Failure state | Photo upload pending → items show "waiting to upload". |
| Success state | "Inspection saved (24 items, 18 photos)." |
| Dependencies | F-DOC-1 |

#### F-MIN-2 Opening meter readings
Covers: MOVEIN-002

| Attribute | Specification |
|---|---|
| Purpose | Fix the starting point for utility billing. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Unit has meters (else "Add meter" shortcut). |
| Inputs | For each meter: value*, photo (strongly recommended), date = move-in date. |
| Outputs | Readings of type MOVE_IN linked to the tenancy. |
| Business rules | Value must be ≥ the meter's last reading unless marked meter replacement (BR-017). |
| Validations | Numeric ≥ 0, ≤ 3 decimals. |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Skip with reason (meter inaccessible) → tenancy flagged; the next regular reading becomes the baseline. |
| Empty state | "This unit has no meters." |
| Failure state | READING_LOWER_THAN_PREVIOUS with the previous value shown. |
| Success state | Readings listed on the review step. |
| Dependencies | F-UTIL-1 |

#### F-MIN-3 First charges proposal
Covers: MOVEIN-003

| Attribute | Specification |
|---|---|
| Purpose | Show and confirm exactly what the tenant owes at move-in. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Terms entered. |
| Inputs | Calculated proposals; user edits per line (amount; remove line; add one-time charge). |
| Outputs | Lines: first period rent (prorated if partial), full periods up to today (backdated), recurring charges per period, deposit, one-time charges; totals: "Due at move-in" and "Deposit". |
| Business rules | `10` §5. Edited lines keep their generated key so the job won't duplicate them. |
| Validations | Amount ≥ 0 (0 = line removed). |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Move-in on cycle day → no proration. |
| Empty state | n/a |
| Failure state | n/a |
| Success state | Included in the atomic start operation. |
| Dependencies | 10 |

---

## 12. Move-Out

#### F-MOUT-1 Notice
Covers: MOVEOUT-001

| Attribute | Specification |
|---|---|
| Purpose | Record that the tenant (or landlord) gave notice and when they will leave. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy ACTIVE. |
| Inputs | Notice date*, planned move-out date*, given by (tenant/landlord), note. Withdraw notice action. |
| Outputs | Tenancy on notice; unit "On notice"; digest reminders at 7 and 1 day. |
| Business rules | Charge generation stops for periods starting after the planned date. A new tenancy may start the day after the planned date (BR-005). |
| Validations | Planned date ≥ notice date and ≥ move-in; warning if shorter than the notice period. |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Tenant stays longer → edit planned date (blocked if it overlaps an upcoming tenancy: UNIT_OCCUPIED). |
| Empty state | n/a |
| Failure state | Inline. |
| Success state | "On notice — leaving 31 Mar 2027." |
| Dependencies | F-NOT-1 |

#### F-MOUT-2 Record move-out
Covers: MOVEOUT-002

| Attribute | Specification |
|---|---|
| Purpose | Capture the handover facts. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy ACTIVE. |
| Inputs | Actual move-out date*, final readings per meter (photos), move-out inspection (items prefilled from move-in with move-in condition shown beside), keys returned, notes. |
| Outputs | `moved_out_on` set; status ENDED; readings MOVE_OUT; inspection MOVE_OUT; a settlement DRAFT is created. |
| Business rules | Unit is free from the day after move-out. |
| Validations | Move-out ≥ move-in; ≤ today + 30 days (pre-recording allowed). |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Tenant left without notice (no F-MOUT-1) → allowed; abandoned unit → note + photos. |
| Empty state | n/a |
| Failure state | Inline; offline works. |
| Success state | Opens settlement (F-MOUT-3). |
| Dependencies | F-MIN-1, F-UTIL-2 |

#### F-MOUT-3 Settlement
Covers: MOVEOUT-003, MOVEOUT-004, DEP-004

| Attribute | Specification |
|---|---|
| Purpose | Close the money side of a tenancy transparently. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Tenancy ENDED; no other open settlement. |
| Inputs | Proposed lines: void future-period charges, final-period proration credit, final utility charges (from final readings), deductions (damage, cleaning, other; each with amount, reason, photos), deposit application (auto), refund now or later (method, date, reference). All proposals editable. |
| Outputs | On finalize (atomic): all entries created, settlement FINALIZED with snapshot, settlement PDF; status CLOSED if rent balance and deposit held are both 0, otherwise ENDED with "Refund due ₹x" or "Tenant owes ₹x". |
| Business rules | `10` §10. Server recomputes the preview at finalize; if the ledger changed since the preview (e.g. a payment synced), finalize is rejected (SETTLEMENT_STALE) and the new preview is shown. |
| Validations | Deductions > 0 with reason; refund ≤ available; write-off needs Owner/Admin/Manager confirmation text. |
| Permissions | Owner, Admin, Manager. |
| Edge cases | Tenant owes more than deposit → remains ENDED with balance; later payment or write-off closes it. Tenant has advance credit → refund includes it. Refund paid later → record it, tenancy closes automatically. |
| Empty state | n/a |
| Failure state | SETTLEMENT_STALE flow; offline finalize queued (server re-checks). |
| Success state | "Settlement finalized. Refund ₹19,554 to Rahul." Share PDF. |
| Dependencies | F-DEP-3, F-UTIL-2, PDF generation |

#### F-MOUT-4 Reopen settlement
Covers: MOVEOUT-005

| Attribute | Specification |
|---|---|
| Purpose | Correct a finalized settlement. |
| Actors | Owner, Admin |
| Prerequisites | Settlement FINALIZED. |
| Inputs | Reason*. |
| Outputs | Settlement VOID; all its entries voided; tenancy back to ENDED; a new DRAFT can be prepared. |
| Business rules | Refund entries that represent real money paid can be kept (user choice per refund line: "keep refund" / "void refund"). |
| Validations | — |
| Permissions | Owner, Admin. |
| Edge cases | Unit already re-let → reopening does not affect the new tenancy. |
| Empty state | n/a |
| Failure state | Inline. |
| Success state | "Settlement reopened." |
| Dependencies | F-MOUT-3 |

---

## 13. Electricity / Utility Management

#### F-UTIL-1 Meters
Covers: UTIL-001

| Attribute | Specification |
|---|---|
| Purpose | Define what is metered and at what rate. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Property (and unit, for unit meters). |
| Inputs | Type* (electricity, water, gas, other), label*, serial number, unit of measure* (kWh, m³, litre, unit), rate per unit* (≥ 0, 4 decimals), fixed charge per bill, attached to unit or property (common). |
| Outputs | Meter. |
| Business rules | Currency = property currency. Rate changes apply to charges created after the change; past charges keep their stored rate. |
| Validations | Label unique per unit; rate ≤ 1,000,000. |
| Permissions | See matrix. |
| Edge cases | Common (property) meters are for expense tracking or V1 split; MVP charges only from unit meters. |
| Empty state | "No meters. Add one to bill electricity or water by reading." |
| Failure state | Inline. |
| Success state | Meter listed with "No readings yet". |
| Dependencies | — |

#### F-UTIL-2 Record a reading and bill it
Covers: UTIL-002, UTIL-003

| Attribute | Specification |
|---|---|
| Purpose | Turn a reading into a charge in seconds. |
| Actors | Owner, Admin, Manager (Staff V1) |
| Prerequisites | Meter exists; for billing, the unit has an ACTIVE tenancy and a previous reading. |
| Inputs | Date* (today), value*, photo, "meter replaced" toggle (then old final value + new start value), "Create charge" toggle (default on when billable). |
| Outputs | Reading(s); proposed utility charge: consumption = current − previous (across replacement: (old final − previous) + (current − new start)); amount = `10` §11; description "Electricity 18 Sep–18 Oct: 219.5 kWh × ₹9.50". |
| Business rules | Charge stores reading ids, quantity and rate snapshot. Reading + charge saved as one atomic operation. |
| Validations | Value ≥ previous unless replacement; date ≥ previous reading date; one reading per meter/date/type (READING_DUPLICATE). |
| Permissions | See matrix. |
| Edge cases | Reading spans two tenancies (tenant changed) → the app proposes billing only the current tenancy from its MOVE_IN reading; consumption before that belongs to the previous settlement. No previous reading → saved as baseline, no charge. |
| Empty state | n/a |
| Failure state | Inline + sync issue on server rejection. |
| Success state | "Reading saved. ₹2,085 added to Room 101." |
| Dependencies | F-UTIL-1, 10 §11 |

#### F-UTIL-3 Readings round
Covers: UTIL-004

| Attribute | Specification |
|---|---|
| Purpose | Read all meters in a building in one walk. |
| Actors | Owner, Admin, Manager |
| Prerequisites | Property has meters. |
| Inputs | Date (default today); for each meter row (sorted by floor/label): previous reading + date, new value input, photo button; skip per row. |
| Outputs | One atomic operation per meter (reading + charge), so a failure on one meter does not block others. Summary: meters read, charges created, total amount. |
| Business rules | As F-UTIL-2 per row. Rows of vacant units save readings without charges. |
| Validations | Per row; invalid rows highlighted; "Save" saves valid rows only after confirmation. |
| Permissions | See matrix. |
| Edge cases | Half-finished round → draft kept on device until saved or discarded. |
| Empty state | "No meters in this property." |
| Failure state | Per-row errors. |
| Success state | "18 readings saved, 15 charges created (₹31,240)." |
| Dependencies | F-UTIL-2 |

---

## 14. Expense Management

#### F-EXP-1 Record, edit and void expenses
Covers: EXP-001, EXP-002

| Attribute | Specification |
|---|---|
| Purpose | Know net income per property. |
| Actors | Owner, Admin, Manager |
| Prerequisites | — |
| Inputs | Property (optional, else workspace-level), unit (optional), category* (repair, maintenance, utility, property tax, insurance, salary, commission, legal, loan interest, other), amount*, date*, payee, method, reference, note, receipt photo. |
| Outputs | Expense. |
| Business rules | Expenses are not tenant-facing, so edits are allowed (audited, last-write-wins), and void is available. Currency = property currency (workspace default if no property). |
| Validations | Amount > 0; date ≤ today + 1. |
| Permissions | See matrix. |
| Edge cases | Expense recharged to tenant → record expense and add a tenant charge separately (link in note). |
| Empty state | "No expenses recorded this month." |
| Failure state | Inline. |
| Success state | Property month summary updates net cash. |
| Dependencies | F-DOC-1 |

## 15. Maintenance

Future (MAINT-001, D-042). In the MVP, repair work is recorded as an expense with photos and notes. In V1, chat (F-V1-3) carries tenant requests. A structured ticket module (status, assignee, vendor, cost) is planned after V1.

---

## 16. Documents

#### F-DOC-1 Attach and upload
Covers: DOC-001, DOC-002, DOC-003, DOC-006

| Attribute | Specification |
|---|---|
| Purpose | Keep proof and paperwork with the record it belongs to. |
| Actors | Owner, Admin, Manager (Viewer cannot upload) |
| Prerequisites | Parent record exists (or is being created in the same flow). |
| Inputs | Camera photo, gallery image, or PDF; category*; title. |
| Outputs | Document metadata (synced) + file in private storage. Android compresses photos to ≤ 1920 px long edge, JPEG quality 80. |
| Business rules | Offline: metadata is created at once and the file uploads later (`08` §12). ID/address/police categories are sensitive automatically. Quota check on upload request. |
| Validations | MIME in {image/jpeg, image/png, image/webp, application/pdf}; ≤ 10 MB after compression; ≤ 50 documents per parent record. |
| Permissions | See matrix. |
| Edge cases | Upload fails repeatedly → shown in sync issues with retry; parent deleted before upload → upload cancelled. |
| Empty state | "No documents. Add agreement, ID or photos." |
| Failure state | QUOTA_EXCEEDED: "Storage full (1 GB). Delete old files or contact support." |
| Success state | Thumbnail appears (clock icon until uploaded). |
| Dependencies | Storage (06), 08 |

#### F-DOC-2 View documents and access control
Covers: DOC-004

| Attribute | Specification |
|---|---|
| Purpose | Let the right people see files; protect ID documents. |
| Actors | Per matrix |
| Prerequisites | Online (unless cached locally on Android). |
| Inputs | Tap document. |
| Outputs | Image viewer (zoom) or PDF viewer via short-lived signed URL (≤ 5 min). |
| Business rules | Sensitive views create an audit event. Android caches non-sensitive files; sensitive files are kept only in the temporary cache and cleared on sign-out. |
| Validations | Server checks role and property scope before issuing a URL. |
| Permissions | Per matrix. |
| Edge cases | Viewer opens tenant documents → sensitive ones hidden ("2 restricted documents"). |
| Empty state | As F-DOC-1. |
| Failure state | "You don't have access to this document." / offline: "Connect to open this file." |
| Success state | File shown; share button (non-sensitive only unless Owner/Admin). |
| Dependencies | 11 |

#### F-DOC-3 Delete and restore documents
Covers: DOC-005

| Attribute | Specification |
|---|---|
| Purpose | Remove wrong uploads safely. |
| Actors | Owner, Admin, Manager |
| Prerequisites | — |
| Inputs | Confirmation. |
| Outputs | Soft-deleted document; restorable 30 days from "Recently deleted" (website); purged afterwards (file too). |
| Business rules | Quota is freed at purge. |
| Validations | — |
| Permissions | See matrix. |
| Edge cases | Document referenced by a finalized settlement (deduction photo) → deletion blocked. |
| Empty state | "Nothing recently deleted." |
| Failure state | Inline. |
| Success state | "Document deleted. Undo." |
| Dependencies | Cleanup job (06) |

---

## 17. Notifications

Full catalogue in `12_NOTIFICATION_SPECIFICATION.md`.

#### F-NOT-1 Daily digest
Covers: NOTIF-001

| Attribute | Specification |
|---|---|
| Purpose | One calm daily prompt instead of many alerts. |
| Actors | System → members |
| Prerequisites | Member has the Android app with push permission (in-app copy always created). |
| Inputs | Member's scope, digest time, workspace time zone. |
| Outputs | Push: "Today: 3 rents due (₹45,000) · 2 newly overdue · 1 move-out on Fri"; tap opens Home. |
| Business rules | At most one digest per member per workspace per day; skipped when there is nothing to report; counts limited to the member's scope. |
| Validations | n/a |
| Permissions | All roles (Viewer included). |
| Edge cases | Member in 3 workspaces → up to 3 digests (one per workspace). |
| Empty state | n/a |
| Failure state | Push failure → in-app item still exists. |
| Success state | — |
| Dependencies | FCM (06) |

#### F-NOT-2 Notification centre and preferences
Covers: NOTIF-002, NOTIF-004

| Attribute | Specification |
|---|---|
| Purpose | Review past alerts; control what arrives. |
| Actors | All members |
| Prerequisites | — |
| Inputs | Preferences: digest on/off and time; per-event toggles (12 §3). |
| Outputs | List with unread badges; "Mark all read". |
| Business rules | Stored per member per workspace; synced. |
| Validations | Time in 15-minute steps. |
| Permissions | Self. |
| Edge cases | Push permission denied on Android → banner in centre "Turn on notifications". |
| Empty state | "You're all caught up." |
| Failure state | Standard. |
| Success state | — |
| Dependencies | F-NOT-1 |

#### F-NOT-3 Transactional email
Covers: NOTIF-003

| Attribute | Specification |
|---|---|
| Purpose | Deliver account-critical messages. |
| Actors | System |
| Prerequisites | Verified email. |
| Inputs | Events: sign-in code, invite, access changed/revoked, ownership transferred, deletion scheduled/completed, storage 80%/100%. |
| Outputs | Plain, branded-light emails. |
| Business rules | No marketing emails without opt-in. |
| Validations | n/a |
| Permissions | n/a |
| Edge cases | Bounce → mark email unverified, show banner in app. |
| Empty state | n/a |
| Failure state | Retries by provider; logged. |
| Success state | — |
| Dependencies | Email provider |

#### F-NOT-4 Local sync reminders (Android)
Covers: NOTIF-005

| Attribute | Specification |
|---|---|
| Purpose | Prevent forgotten unsynced data. |
| Actors | Android app |
| Prerequisites | Pending changes older than 24 h, or failed changes needing action. |
| Inputs | Outbox state. |
| Outputs | Local notification "5 changes haven't synced for a day. Open to sync." / "1 change needs your attention." |
| Business rules | At most once per day. |
| Validations | n/a |
| Permissions | n/a |
| Edge cases | App force-stopped → WorkManager resumes when possible. |
| Empty state | n/a |
| Failure state | n/a |
| Success state | Opens Sync status (SCR-98). |
| Dependencies | 08 |

---

## 18. Reports

Definitions, calculations and formats are in `13_REPORTING_SPECIFICATION.md`.

#### F-REP-1 Standard reports
Covers: REP-002, REP-003, REP-004, REP-006, REP-007, REP-008, REP-009

| Attribute | Specification |
|---|---|
| Purpose | Answer recurring questions: rent roll, who owes, what came in, deposits, expenses, income per property, vacancies, lease expiries. |
| Actors | All roles (scoped) |
| Prerequisites | Website online; Android: reports computed from local data (CSV export needs online). |
| Inputs | Report type, filters (property, date range/as-of, method, category), grouping, sorting. |
| Outputs | Table with totals per currency; CSV export. |
| Business rules | 13. |
| Validations | Date range ≤ 5 years. |
| Permissions | Scoped. |
| Edge cases | Mixed currencies → separate total rows. |
| Empty state | "No data for these filters." |
| Failure state | Standard. |
| Success state | — |
| Dependencies | 13 |

#### F-REP-2 Tenant statement
Covers: REP-005

| Attribute | Specification |
|---|---|
| Purpose | A dispute-proof history for one tenancy. |
| Actors | Owner, Admin, Manager, Viewer |
| Prerequisites | Online for PDF. |
| Inputs | Tenancy, date range (default: whole tenancy). |
| Outputs | PDF/CSV: opening balance, entries with running balance, closing balance, deposit summary; share. |
| Business rules | 13 §7. Voided entries excluded (listed in an appendix section "Voided entries"). |
| Validations | — |
| Permissions | See matrix. |
| Edge cases | Range starting mid-tenancy → opening balance computed as of range start − 1 day. |
| Empty state | "No entries in this period." |
| Failure state | Retry. |
| Success state | Share sheet. |
| Dependencies | PDF generation |

#### F-REP-3 Full data export
Covers: REP-010

| Attribute | Specification |
|---|---|
| Purpose | Data portability, accountant hand-off, trust. |
| Actors | Owner, Admin (website) |
| Prerequisites | Online. |
| Inputs | Include archived (yes/no). |
| Outputs | Streaming ZIP of CSVs (one per entity, 13 §13) with a README.txt describing columns. |
| Business rules | Audited. Document files not included in MVP (list with names only); V1 adds files. |
| Validations | One export at a time per workspace. |
| Permissions | Owner, Admin. |
| Edge cases | Very large workspace → still streamed; timeout risk noted in 19. |
| Empty state | n/a |
| Failure state | "Export failed, try again." |
| Success state | Browser download starts. |
| Dependencies | 13 |

---

## 19. Search & Filtering

#### F-SRCH-1 Global search
Covers: SRCH-001

| Attribute | Specification |
|---|---|
| Purpose | Jump to any tenant, unit, property or receipt. |
| Actors | All roles (scoped) |
| Prerequisites | — |
| Inputs | Text (≥ 2 chars). |
| Outputs | Grouped results: Tenants (name, phone), Units ("Room 101 · Green Villa"), Properties, Receipts (number, amount, tenant). |
| Business rules | Case- and accent-insensitive contains-match; phone matches ignore spaces and country code. Android searches locally; web uses server search. |
| Validations | — |
| Permissions | Scoped results only. |
| Edge cases | Archived items shown with chip, after active ones. |
| Empty state | "No matches for 'xyz'." |
| Failure state | Web: retry. |
| Success state | Tap opens detail. |
| Dependencies | 05 indexes |

#### F-SRCH-2 Filters and property switcher
Covers: SRCH-002

| Attribute | Specification |
|---|---|
| Purpose | Focus on one property or a slice of data. |
| Actors | All roles |
| Prerequisites | — |
| Inputs | Property filter (All / one / several), plus list-specific filters. |
| Outputs | Filtered lists and totals. |
| Business rules | The property filter persists across Home, Money and Reports until changed (stored per user on device/browser). |
| Validations | — |
| Permissions | Only accessible properties listed. |
| Edge cases | Filtered property archived → filter resets to All with notice. |
| Empty state | "No results with these filters. Clear filters." |
| Failure state | — |
| Success state | — |
| Dependencies | — |

---

## 20. Settings

#### F-SET-1 Workspace settings
Covers: SET-001

| Attribute | Specification |
|---|---|
| Purpose | Configure defaults and what appears on documents. |
| Actors | Owner, Admin |
| Prerequisites | — |
| Inputs | Name, country, default currency (for new properties), time zone, "Round calculated amounts to whole units" (default on), receipt prefix (≤ 10 chars) and footer (≤ 300), landlord display name/address/phone/email for PDFs, default digest time, payment instructions (F-PAY-5). |
| Outputs | Updated workspace. |
| Business rules | Time-zone change affects future "today" computations only. Rounding change affects future calculations only. |
| Validations | Valid codes; prefix alphanumeric plus "-" or "/". |
| Permissions | Owner, Admin. |
| Edge cases | Changing receipt prefix does not renumber old receipts. |
| Empty state | n/a |
| Failure state | Inline. |
| Success state | "Settings saved." |
| Dependencies | — |

#### F-SET-2 Display preferences
Covers: SET-002

| Attribute | Specification |
|---|---|
| Purpose | Match formats to the user. |
| Actors | Any user |
| Prerequisites | — |
| Inputs | Language (English only at launch), theme follows system. |
| Outputs | Formatting via device/browser locale; currency from property. |
| Business rules | PDFs use workspace country locale for consistency. |
| Validations | — |
| Permissions | Self. |
| Edge cases | — |
| Empty state | n/a |
| Failure state | n/a |
| Success state | — |
| Dependencies | — |

---

## 21. Sync & Offline

#### F-SYNC-1 Offline-first sync (Android)
Covers: SYNC-001 … SYNC-009

Specified completely in `08_SYNC_SPECIFICATION.md`. User-visible behaviour:

| Attribute | Specification |
|---|---|
| Purpose | Work anywhere; never lose or duplicate an entry. |
| Actors | Android app, server |
| Prerequisites | Initial sync completed once online after sign-in. |
| Inputs | Local changes; server changes. |
| Outputs | Converged data on all devices. |
| Business rules | 08: outbox, idempotent ops, cursor pull, conflict rules, rejection handling. |
| Validations | Server is final. |
| Permissions | Server enforces on every op. |
| Edge cases | 08 §15 and 18. |
| Empty state | First launch offline after sign-in → "Connect to download your data." |
| Failure state | Sync issues screen with reason and actions. |
| Success state | Status "Synced · 1 min ago". |
| Dependencies | 07, 08 |

---

## 22. Version 1 modules (outline)

These are specified at outline level now and fully before V1 work starts. The MVP database already reserves their tables (05 §6).

| ID | Feature | Summary | Key rules |
|---|---|---|---|
| F-V1-1 | Tenant portal | Tenant signs in by phone code (ACC-006) from an invite; sees tenancies across workspaces, dues, ledger, receipts, shared documents, payment instructions; submits payment claims (PAY-010). | Tenant sees only their tenancies; no other tenant data; documents shared explicitly (`visible_to_tenant`). |
| F-V1-2 | Notice board | Post to all tenants / properties / units; attachments; push; read receipts; expiry. | Audience resolved at publish time; late joiners see active notices of their property. |
| F-V1-3 | Chat | One conversation per tenancy; tenants + members with access; text, a few compressed images (no PDFs, D-057), "payment details" card (instructions + amount due + QR); unread counts; push; report message. | Realtime delivery (Supabase Realtime) with push fallback; messages immutable except delete-for-everyone within 15 min; retention D-055. |
| F-V1-4 | Billing | Owner subscribes on the website; quantity = billable properties (D-010); grace 14 days then read-only. | No data deletion for non-payment; Android shows status only (D-046). |
| F-V1-5 | Staff role | Field data entry: payments, readings, expenses on assigned properties; void own entries ≤ 24 h. | TEAM-008. |
| F-V1-6 | Automatic late fees | Per-tenancy rule: fixed or % of overdue remaining, N days after due date, once per charge; auto-voided if a backdated payment shows it was paid in time. | `10` §12. |
