# 12 — Notification Specification

```text
Version:      0.1
Status:       Draft — awaiting owner review
Last Updated: 2026-09-18
Depends On:   01_PRD.md (NOTIF-*), 02_FEATURE_SPECIFICATION.md (F-NOT-*), 06_SYSTEM_ARCHITECTURE.md §10
Affected By:  16_DECISION_LOG.md (D-005, D-028)
```

## 1. Principles

1. **One calm daily summary** instead of an alert per event. Landlords check rent in bursts (first week of the month); a digest matches that.
2. **Never empty, never duplicated:** no digest when there is nothing to say; each notification has a dedupe key.
3. **Respect preferences** except for account-security emails, which cannot be turned off.
4. **Private on the lock screen:** the public version shows counts only, no names or amounts.
5. **The MVP never messages tenants automatically.** Landlords send reminders through their own WhatsApp/SMS/email with prefilled text (D-028). Tenant notifications arrive with tenant accounts in V1.

## 2. Channels

| Channel | Release | Used for |
|---|---|---|
| Push (FCM, Android) | MVP | Digest; selected activity events |
| In-app notification centre (Android + web) | MVP | Every notification is also stored here (180 days) |
| Email (transactional) | MVP | Sign-in codes, invites, access and account events, quota |
| Local notification (Android) | MVP | Unsynced changes, sync issues |
| Manual share (landlord's WhatsApp/SMS/email) | MVP | Reminders, receipts, statements, settlements to tenants |
| Tenant push/email | V1 | Rent due, receipts, notices, chat |
| Silent push (data message) | V1 | Trigger sync on devices after changes by others |
| Web push | Future | — |
| Automated WhatsApp/SMS (provider API) | Future | Tenant reminders at scale (cost per message, template approval) |

## 3. Catalogue

"Pref" = preference key (user can disable) or "—" (mandatory). "Dedupe" = key making the notification unique.

### 3.1 MVP

| ID | Event / trigger | Recipient | Message | Channel | Timing | Dedupe | Pref |
|---|---|---|---|---|---|---|---|
| NTF-01 | Daily digest: at least one of: charges due today, charges that became overdue today, planned move-outs within 7 days, leases ending within 30 days, deposits not fully collected 7+ days after start | Each active member (scoped) with digest on | §4 | Push + in-app | Member's digest time (default workspace 09:00, workspace time zone) | `digest:<ws>:<date>` | `digest` |
| NTF-02 | Lease ends in 30 days / 7 days (no planned move-out) | Owner, Admin, Managers of the property | "Lease for Room 12 · Anita ends on 31 Oct." | In-app (+ digest line) | Job run on that day | `lease:<tenancy>:<30/7>` | `lease_expiry` |
| NTF-03 | Planned move-out in 7 days / tomorrow | Same | "Rahul moves out of Room 101 on Fri 12 Mar. Plan final readings and inspection." | In-app (+ digest line) | That day | `moveout:<tenancy>:<7/1>` | `move_out` |
| NTF-04 | Deposit due > 0, 7 days after start | Same | "Deposit ₹10,000 still due from Anita (Room 12)." | In-app (+ digest line) | Day 7 | `deposit:<tenancy>` | `deposit_due` |
| NTF-05 | Server flags possible duplicate payment | Recorder + Owner/Admin | "Possible duplicate: ₹15,000 for Room 101 on 3 Oct was recorded twice." | In-app + push | Immediately after sync/save | `dup:<entry>` | — |
| NTF-06 | Payment recorded by another member | Owner/Admin (opt-in) | "Priya recorded ₹15,000 from Rahul (Room 101)." | In-app (push optional) | Immediate | `pay:<entry>` | `team_payments` (off by default) |
| NTF-07 | Settlement finalized | Owner/Admin | "Settlement finalized for Room 101: refund ₹19,554." | In-app | Immediate | `settle:<settlement>` | `settlements` |
| NTF-08 | Member invited | Invitee (email) | "<inviter> invited you to <workspace> as Manager." + link | Email | Immediate | invite id | — |
| NTF-09 | Invite accepted | Inviter | "Priya joined <workspace>." | In-app | Immediate | `joined:<membership>` | `team` |
| NTF-10 | Role/access changed or revoked | Affected member | "Your access to <workspace> changed: Viewer, 2 properties." / "…was removed." | Email + in-app | Immediate | `access:<membership>:<version>` | — |
| NTF-11 | Ownership transferred | Old + new Owner | "<name> is now the owner of <workspace>." | Email | Immediate | `owner:<ws>:<version>` | — |
| NTF-12 | Account/workspace deletion scheduled, cancelled, completed | User / all members | "Your account will be deleted on 18 Oct. Sign in to cancel." | Email | Immediate; completion on day 30 | `del:<id>:<state>` | — |
| NTF-13 | Storage at 80% / 100% | Owner | "Storage is 80% full (820 MB of 1 GB)." | In-app + email | When crossed | `quota:<ws>:<80/100>:<month>` | — |
| NTF-14 | Sign-in code | User | "Your code is 482913. It expires in 10 minutes." | Email (Supabase) | Immediate | — | — |
| NTF-15 | Unsynced changes > 24 h, or a sync issue needs action | Device user | "5 changes haven't synced for a day." / "1 change needs your attention." | Local (Android) | Daily check | once per day | — |
| NTF-16 | App version below minimum | Device user | "Update the app to keep syncing." | In-app blocking screen | On detection | — | — |

### 3.2 Version 1

| ID | Event | Recipient | Channel | Timing | Pref |
|---|---|---|---|---|---|
| NTF-20 | Rent due soon | Tenant | Push/email | 3 days before and on due date (tenant time zone, 09:00–20:00) | tenant `rent_due` + landlord toggle per workspace |
| NTF-21 | Payment recorded → receipt available | Tenant | Push/email | Immediate | `receipts` |
| NTF-22 | Rent overdue | Tenant | Push/email | 1 and 7 days after due (landlord-configurable) | landlord toggle |
| NTF-23 | New notice | Tenants in audience | Push + in-app | On publish (respect quiet hours unless marked urgent) | `notices` |
| NTF-24 | New chat message | Other side | Push (batched per conversation, not while the thread is open) | ≤ 1 per 5 min per thread | `chat` |
| NTF-25 | Payment claim submitted / accepted / rejected | Landlord members / tenant | Push + in-app | Immediate | `claims` |
| NTF-26 | Lease ends in 30 days | Tenant | Push/email | Once | `lease_expiry` |
| NTF-27 | Weekly summary | Owner/Admin | Email | Monday 08:00 | `weekly_summary` |
| NTF-28 | Billing: trial ending, payment failed, renewed | Owner | Email + in-app | Provider events | — |
| NTF-29 | Data changed (silent) | Member devices | Silent push | Debounced 30 s per workspace | — |

## 4. Daily digest (NTF-01)

**Job:** every 15 minutes. For each active member with digest on, it checks whether their digest time (in the workspace time zone) has passed today and whether no `digest:<ws>:<date>` notification exists for them. If both hold, it computes the content within the member's property scope.

**Content (lines in this order, only non-zero lines):**
1. "3 rents due today (₹45,000)" (charges with due_date = today, remaining > 0)
2. "2 newly overdue (₹20,000)" (charges whose due_date = yesterday, remaining > 0)
3. "1 move-out this week: Room 12 (Fri)"
4. "2 leases end within 30 days"
5. "1 deposit still due"

Money is grouped per currency ("₹45,000 · $1,200").

**Push:** title "<workspace name> · Today", body = first two lines + "and 2 more". Tap opens Home with the "Needs attention" section. Public (lock screen) version: "<workspace name>: 5 updates".

**Empty:** no notification of any kind.

## 5. Message templates (manual share to tenants, MVP)

Placeholders in `{braces}`; blocks in `[brackets]` are omitted when their data is missing. Templates are stored as strings (localizable). Landlords can edit the text before sending; editing templates is Future.

**Reminder (one period due):**
```text
Hello {tenant_first_name}, a gentle reminder that rent of {amount_due} for {unit_label}, {property_name} for {period_label} is due on {due_date}.
[Pay by UPI: {payment_handle}.] [Bank: {bank_details}.] [Pay online: {payment_link}.]
Thank you, {landlord_name}
```

**Reminder (overdue, several charges):**
```text
Hello {tenant_first_name}, your pending balance for {unit_label} is {balance}, including dues since {oldest_due_month}.
[Pay by UPI: {payment_handle}.] [Bank: {bank_details}.] [Pay online: {payment_link}.]
Please let me know once paid. Thank you, {landlord_name}
```

**Receipt share:**
```text
Receipt {receipt_number}: received {amount} on {payment_date} for {unit_label}, {property_name}. Thank you, {landlord_name}
```

**Statement share:**
```text
Statement for {unit_label} ({from_date} – {to_date}). Current balance: {balance_or_all_paid}.
```

**Settlement share:**
```text
Move-out settlement for {unit_label}: deposit held {deposit_held}, deductions {deductions}, [refund {refund_due} {refund_method_date}] [amount due from you {amount_owed}]. Details attached.
```

**Payment details:**
```text
You can pay rent for {unit_label} by UPI to {payment_handle}[, by bank transfer to {bank_details}][, or online: {payment_link}].
```

Formatting uses the workspace country locale ("₹15,000", "5 Oct 2026"). WhatsApp links use `https://wa.me/<E.164 without +>?text=<url-encoded>`; SMS uses `sms:<number>?body=`; email uses `mailto:`.

## 6. Preferences

Stored in `memberships.notification_prefs` (per member per workspace) and `memberships.digest_time`:

```json
{
  "digest": true,
  "lease_expiry": true,
  "move_out": true,
  "deposit_due": true,
  "team_payments": false,
  "settlements": true,
  "team": true
}
```
Defaults as shown. Mandatory notifications (security, account, invites, quota, duplicates) are not listed and cannot be disabled. Android notification channels: **Daily summary**, **Activity**, **Sync**, which users can also mute in system settings.

## 7. Delivery details

| Topic | Rule |
|---|---|
| FCM | HTTP v1 API from the server; `android.priority = normal` (digest) / `high` (none in MVP); `collapse_key` = `digest:<ws>` so only the latest digest shows |
| Tokens | Registered after sign-in and on token refresh (`POST /devices`); removed on sign-out; deleted when FCM reports `UNREGISTERED` |
| In-app records | Created first; push is best effort; failure does not lose the notification |
| Deep links | `rentmanager://w/<ws>/tenancies/<id>` (Android) and `/w/<ws>/tenancies/<id>` (web) |
| Email | From `no-reply@<domain>`, reply-to support address; plain, text-first HTML; SPF/DKIM/DMARC configured |
| Retention | In-app notifications kept 180 days |
| Caps | ≤ 1 digest per member per workspace per day; activity pushes ≤ 10 per hour per member (excess only in-app) |
| Quiet hours | V1 tenant notifications only between 09:00–20:00 tenant local time (except urgent notices) |

## 8. Tests

NOTIF-TEST-001…004 (14): digest once per day per time zone; empty digest suppressed; lease/move-out thresholds fire once; local unsynced reminder after 24 h.
