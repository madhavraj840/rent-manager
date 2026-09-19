# 11 — Security & Privacy

```text
Version:      0.1
Status:       Draft — awaiting owner review; items marked [LEGAL CHECK] need a lawyer before public launch
Last Updated: 2026-09-18
Depends On:   01_PRD.md §12 (permissions), 05_DATABASE_DESIGN.md, 06_SYSTEM_ARCHITECTURE.md, 08_SYNC_SPECIFICATION.md
Affected By:  16_DECISION_LOG.md (D-025, D-033, D-037, D-038)
```

## 1. What we protect and from whom

| Asset | Why it matters |
|---|---|
| Tenant identity documents (ID, address proof, police verification) | Identity theft; legal liability |
| Tenant personal data (names, phones, addresses, emergency contacts) | Privacy; spam and fraud |
| Financial records (rents, payments, deposits, expenses) | Business confidentiality; dispute evidence; tax |
| Landlord accounts and sessions | Full control of a workspace |
| Integrity of the ledger | A wrong balance destroys trust |

| Threat actor | Examples | Main defences |
|---|---|---|
| Outsider on the internet | Credential stuffing, API probing, scraping signed URLs | No passwords (OTP/Google), rate limits, authorization on every request, short-lived signed URLs |
| User of another workspace | Guessing IDs to read other landlords' data | Workspace isolation on every query (§5), UUIDs, 404 for out-of-scope |
| Member with limited role | Viewer or scoped manager trying to see more | Server-side role and scope checks; UI hiding is only cosmetic |
| Former member | Keeps using an old session | Revocation checked on every request; local data wiped (08 §15) |
| Lost or stolen phone | Opening the app, extracting files | OS encryption, app-private storage, optional biometric lock, sensitive docs not persisted, remote session revocation |
| Insider (developer/operator) | Browsing customer data | Least-privilege access, production access logged, no customer data in logs |
| Supply chain | Malicious dependency | Minimal dependencies, lockfiles, automated vulnerability alerts |

## 2. Sensitive data inventory

| Data | Class | Stored where | Protection | Retention |
|---|---|---|---|---|
| ID/address/police document files | **Restricted** | Storage bucket (private) + Android temporary cache | Sensitive flag, role check, audited view, 5-min signed URLs, not cached persistently on device, FLAG_SECURE viewer | Until deleted by user, or workspace purge |
| ID type + last 4 characters | Confidential | DB | Role-based access | Tenant record lifetime |
| Tenant contact data | Confidential | DB, Android DB | Isolation, TLS, device encryption | Workspace lifetime (V1: anonymize on request) |
| Money records | Confidential | DB, Android DB | Isolation, append-only, audit | Workspace lifetime |
| Payment instructions (UPI ID, bank text, QR) | Confidential | DB, bucket | Owner/Admin edit only | Workspace lifetime |
| Auth identities (email, Google subject) | Confidential | Supabase Auth | Provider-managed | Until account deletion |
| Session tokens | Secret | Web: httpOnly cookies; Android: encrypted storage (Keystore) | Short-lived access, rotating refresh | Session |
| Audit events | Confidential | DB | Append-only, Owner/Admin only | Workspace lifetime |
| Backups | Restricted | Supabase + off-site bucket | Encrypted (age), separate key, restricted access | 7 days / 4 weeks |

### 2.1 What we deliberately do **not** store
- Full ID numbers (Aadhaar, passport, national ID). Only the type and last 4 characters (D-025).
- Passwords (no password sign-in).
- Card numbers, bank credentials, UPI PINs or any payment credential. The app never moves money (D-004).
- Phone contacts, call logs, SMS, location. No such permissions are requested.
- Photo location metadata. EXIF is stripped because images are re-encoded before upload (§8).
- Analytics or advertising identifiers. The MVP has no third-party analytics SDK. Crash reports scrub personal data (§12).

## 3. Authentication

| Topic | Design |
|---|---|
| Methods | Google sign-in; email one-time code (6 digits, 10-min expiry, max 5 attempts, resend after 60 s). Phone OTP in V1. |
| Provider | Supabase Auth. Rate limits on OTP sending and verification per email and IP. |
| Tokens | JWT access token (~1 h), rotating refresh token. Verified by the API with JWKS public keys (no shared secret in the API if asymmetric keys are used). |
| Revocation | "Sign out of all devices" revokes refresh tokens. Revocation of a membership is checked on every request, independent of token lifetime. |
| Account takeover | No passwords to phish or stuff. Email changes are managed at the identity provider. Owner-role actions (delete workspace, transfer ownership) require typed confirmation. |
| MFA | Not in MVP (email OTP/Google are already possession-based). V1: optional TOTP for Owners/Admins. |
| Invites | Token stored only as a SHA-256 hash, single-use (hash cleared on acceptance), 7-day expiry, bound to the invited email |

## 4. Authorization

- **Single enforcement point:** every request passes `verifyRequest` (identity) and `can(member, action, resource)` (01 §12 matrix, property scope). This applies to REST handlers, sync push ops (per op), sync pull filters, report queries, document URL issuance and PDF generation.
- **Deny by default:** unknown actions are denied. New endpoints must declare their action, and CI fails if a route handler has no authz call (lint rule / test that enumerates routes).
- **404 for out-of-scope** resources, so the existence of other workspaces' or properties' records is not revealed. `403` only when the caller can see the resource but not perform the action.
- **UI hiding is not security.** The server is authoritative. PERM-TEST suite (14) calls every endpoint with every role.
- **V1 tenants:** separate `/tenant/*` endpoints that filter by `tenant_links` of the caller. Tenants never reach workspace endpoints.

## 5. Workspace isolation (landlord ↔ landlord, tenant ↔ tenant)

1. Every table has `workspace_id`; property-scoped tables also have `property_id`.
2. Queries go through a helper that requires a workspace context and adds `workspace_id = $ws` (and scope filters). Raw queries without it are rejected in code review and by a lint rule.
3. App tables live in the non-exposed `app` schema. The `anon` and `authenticated` roles have no privileges. RLS is enabled with no policies, so the Supabase Data API is useless even with a leaked anon key.
4. Storage paths are `ws/<workspace_id>/<document_id>`. Signed URLs are issued only after the document's workspace and scope are checked.
5. Sync pull filters by workspace and scope. Push ops are authorized one by one.
6. SEC-TEST-001 creates two workspaces and asserts that every endpoint returns 404 for cross-workspace IDs.

## 6. API and web security

| Control | Implementation |
|---|---|
| Transport | HTTPS only, TLS 1.2+, HSTS (1 year, includeSubDomains). Android network security config forbids cleartext. |
| Input validation | Zod schemas on every endpoint and op; strict types; unknown fields rejected on writes; size limits (JSON body ≤ 1 MB except push ≤ 5 MB). |
| Injection | Parameterized queries only (Drizzle); no string-built SQL; React escapes output; PDFs render text, not HTML. |
| CSRF (web, cookie auth) | SameSite=Lax cookies + `Origin`/`Host` check on all non-GET requests + no CORS for other origins. |
| CORS | Not enabled for the API. Android uses bearer tokens; the web is same-origin. |
| Security headers | CSP (`default-src 'self'`; images from self and the storage domain; no inline scripts except Next.js nonces), `X-Frame-Options: DENY` (via CSP `frame-ancestors 'none'`), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera only where uploads happen). |
| Rate limiting | Supabase Auth limits; platform firewall rules for API bursts (D-049); push batch limits; exports 1 at a time per workspace. |
| SSRF | The server never fetches user-supplied URLs (payment links are stored and displayed only). |
| Errors | problem+json without stack traces; internal details only in logs with `request_id`. |
| Dependencies | Lockfiles committed; Dependabot/Renovate alerts; `npm audit` and Gradle dependency checks in CI; minimal dependency list (06 §4). |
| Secrets in code | gitleaks scan in CI; `.env*` ignored. |

## 7. Encryption

| Where | Mechanism |
|---|---|
| In transit | TLS for API, storage, auth, FCM, email provider |
| Database at rest | Provider disk encryption (AES-256) |
| Storage at rest | Provider encryption |
| Backups | Off-site dumps encrypted with `age` before upload; the private key is kept offline by the owner (not in CI) |
| Android database and files | Android file-based encryption (device lock) + app-private directories. No SQLCipher in MVP (D-038), because OS encryption protects against offline extraction and SQLCipher adds size and performance cost. Revisit if a customer or regulation requires app-level encryption. |
| Android tokens | EncryptedSharedPreferences/DataStore with Android Keystore keys |
| Android sensitive documents | Only in `cacheDir` while viewing; deleted on sign-out and when the viewer closes; offline-captured ID photos stay in `filesDir` only until uploaded, then are deleted locally |

## 8. File security

- Private bucket; no public URLs. Upload URLs expire in 2 h, download URLs in 5 min. The bucket itself is configured with a 10 MB file-size limit and the MIME allow-list, so an upload URL cannot be used to store larger or other files before `complete` runs. No storage policies grant access to the `anon` or `authenticated` roles.
- MIME allow-list (JPEG, PNG, WebP, PDF), ≤ 10 MB. On `complete`, the server checks the object size and the first bytes (magic number) against the declared type and rejects mismatches.
- Images are re-encoded client-side (resize/compress), which removes EXIF metadata including GPS location.
- PDFs are stored as uploaded and served with `Content-Disposition: attachment` for downloads. The web viewer uses the browser's PDF viewer through a signed URL; no server-side PDF parsing.
- Sensitive categories are flagged automatically and cannot be unflagged. Viewers never receive URLs for them.
- The Android viewer uses `FLAG_SECURE` for sensitive documents (no screenshots, hidden in recent apps).
- Malware scanning is not in the MVP (files are only served back to members of the same workspace). Revisit with V1 tenant sharing and chat.

## 9. Database security

- Roles: `app_api` (owner of schema `app`, used by the API), `app_backup` (read-only, used by the off-site dump), provider admin (only for migrations via CI). No personal accounts have production write access in normal operation.
- Connection strings only in server environment variables.
- Migrations run from CI after review. The ledger immutability trigger and the audit append-only trigger are part of the schema.
- Production data is never copied to local machines. Staging uses synthetic seed data.

## 10. Secrets management

| Secret | Location | Rotation |
|---|---|---|
| Supabase service key, DB URL | Vercel env (production/staging separate) | On suspicion; yearly |
| CRON_SECRET | Vercel env | Yearly |
| FCM service account | Vercel env | Yearly |
| Email API key | Vercel env | Yearly |
| Backup encryption public key | GitHub Actions secret (public key only) | With key pair |
| Android keystore (app signing) | Play App Signing + upload key held offline by owner | Never lose it: back up securely |

The Android app contains only public configuration (Supabase URL and anon key, FCM client config). The anon key cannot read data (§5.3).

## 11. Session management

- Web: httpOnly, Secure, SameSite=Lax cookies managed by @supabase/ssr; refresh on navigation; sign-out clears cookies and revokes the refresh token.
- Android: tokens encrypted; refresh via authenticator; sign-out wipes the local database, files and tokens after the pending-changes check (F-ACC-2); app lock (optional) on cold start and after 60 s in background.
- Revoked or deleted users: API returns 401/404 → the app wipes that workspace's local data (08 §15).

## 12. Audit logs and logging

- **Audit events** (05 §2.25) record: create, update (changed fields before → after), void, delete, archive, restore, sensitive document views, exports, settlement finalize/reopen, invites, role/scope changes, ownership transfer, workspace/account deletion requests. Each records actor, source (WEB/ANDROID/JOB/SYSTEM), time, op_id/request_id.
- Append-only (trigger); visible to Owner/Admin; retained for the workspace's lifetime; deleted with the workspace.
- V1 tenant anonymization also redacts that tenant's personal fields inside audit `changes`.
- **Operational logs** never contain names, phones, emails, document contents or tokens. Only IDs. Sentry is configured to scrub request bodies, headers and user fields. Android crash reports exclude local DB content.

## 13. Backups

Covered in 06 §12. Security points: dumps are encrypted before leaving CI; the off-site bucket is write-only for CI (no list/read); restore is done by the owner with the offline private key; deleted data may persist in backups until they expire (≤ 7 days provider, ≤ 28 days off-site). The privacy policy states this.

## 14. Account deletion, data export, retention

| Event | What happens |
|---|---|
| User deletes account | 30-day grace (cancellable) → profile anonymized, auth user deleted, memberships removed, solo workspaces purged (data + files). Audit entries elsewhere show "Former member". |
| Owner deletes workspace | Access removed at once for all members; 30-day grace; then all rows, files and audit events are purged. |
| Member removed | Access revoked immediately; their authored records stay (the workspace owns them). |
| Tenant asks the landlord to delete their data | The landlord (controller) decides. MVP: delete documents and edit personal fields manually. V1: "Anonymize former tenant" (TENANT-007). |
| Data export | Owner/Admin full ZIP export (REP-010), audited. Tenant statements per tenancy. |
| Retention of operational data | sync_ops 90 d; notifications 180 d; deleted document files 30 d; tombstones ≥ 90 d; logs 30 d (provider). |

Google Play requires account deletion to be available **in the app and on the web** for apps with account creation. Both are provided (FL-25). Verify the current policy text before submission.

## 15. Privacy compliance **[LEGAL CHECK]**

| Topic | Position (to be verified by a lawyer per launch country) |
|---|---|
| Roles | The landlord/workspace is the **controller** (data fiduciary) of tenant data; the product operator is the **processor**. For landlords' own account data, the operator is the controller. |
| Laws to review | EU/UK GDPR, India DPDP Act 2023 and its rules, US state laws (e.g. CCPA/CPRA), UAE PDPL, and any country of launch. |
| Documents needed before public launch | Privacy policy, terms of service, data processing agreement (for business customers), cookie notice (web uses only essential cookies), Google Play Data safety form. |
| Lawful basis | Contract (providing the service to landlords); landlords are responsible for their own basis to process tenant data. |
| Cross-border transfer | Data hosted in one region (D-030); transfers from other regions need appropriate safeguards (e.g. SCCs). |
| ID documents | In-app guidance: "Store only what you need." In India, recommend masked Aadhaar copies. Some countries restrict copying ID documents. |
| Children | Not directed at children; tenants' minor family members may appear as occupants (names only). |
| Breach notification | Operator notifies affected workspace Owners without undue delay; regulators within legal deadlines (e.g. 72 h under GDPR). Landlords may need to notify tenants. |
| Data subject requests | Landlords (controllers) handle tenant requests with the provided tools; the operator assists. |

## 16. Abuse prevention

- Beta limits: 5 workspaces per user, 50 invites per workspace per day, 1 GB storage per workspace, 200 units per bulk operation.
- The MVP never sends messages to tenants itself (the landlord's own WhatsApp/SMS), so the product cannot be used for bulk spam.
- The terms prohibit illegal content. A report-abuse email address is published. V1 chat adds message reporting and rate limits.
- Sign-up abuse: email verification is inherent (OTP); Google accounts are verified.

## 17. Android app hardening

| Setting | Value |
|---|---|
| `android:allowBackup` / data extraction rules | Disabled / exclude everything (local data is a server cache containing tenant PII) |
| Exported components | Only the launcher activity and the FCM service |
| Cleartext traffic | Disabled |
| R8 | Enabled for release (obfuscation + shrinking) |
| WebViews | None |
| Permissions | POST_NOTIFICATIONS; camera access via the system camera intent (no CAMERA permission if not declared); no storage, contacts, location, SMS permissions |
| Screenshots | Blocked only on sensitive document viewer (FLAG_SECURE) |
| Root/tamper detection | Not in MVP (low value for this threat model) |

## 18. Incident response

| Severity | Examples | Response time |
|---|---|---|
| SEV-1 | Cross-workspace data exposure, ledger corruption, credential leak | Start within 1 h; contain (disable feature/rotate secrets); notify affected Owners; regulator notification per §15 |
| SEV-2 | Sync rejects valid ops at scale, backups failing | Same day |
| SEV-3 | Single-user bug | Next working day |

Steps: detect → contain → assess scope (audit logs, request logs) → fix → notify → write a post-mortem and add a regression test.

## 19. Security testing

See `14_TESTING_STRATEGY.md`: SEC-TEST-001…010 (isolation, storage, audit, headers, CSRF, rate limits, file validation, invite binding, deletion purge, RLS deny) and PERM-TEST-001…006 (role matrix). Before the public launch, run an external security review (a freelance penetration test of the API and the Android app) — recommended budget item.
