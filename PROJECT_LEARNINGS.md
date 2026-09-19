# Project Learnings: Rent application

Read this before any significant task, and update it afterwards. The process is described in `self improvement.txt`.
Only record what was seen in the code or confirmed by a test. Mark guesses **ASSUMPTION**. Never put secrets here.

---

# Permanent Project Rules

1. **Simple English in everything people read**, using the word list in `docs/20_UI_CLARITY_GUIDE.md` C-8: room, tenant, cancel, unpaid, days to pay. Code names (`tenancy`, `unit`, `void`) stay as they are. See `CLAUDE.md`.
2. **Never show internal codes or IDs to a user.** Translate at the display layer: `REPAIR` → "Repair", `value_milli 12000` → "12 kWh", and hide UUIDs.
3. **Every screen passes the §5 checklist in docs/20** before it is called done.
4. **Never delete or reset `web/.data`** (the owner's real data). Tests set `RENT_DATA_DIR` to their own folder.
5. **Money records are append-only.** Correct them by cancelling (void) and entering again. Database triggers enforce this (`db/migrations/*_rules.sql`).
6. **Money is stored as integer minor units** (paise), meter readings as numeric with 3 decimals, and rates with 4 decimals. They are formatted only for display.
7. **Every write goes through `run()` in `web/src/server/commands.ts`.** That gives one transaction, the workspace change sequence, the version stamp and an audit row.
8. **Every read and write is scoped to `ctx.workspace.id` on the server.** A client-sent ID is only a lookup key. It is never proof of access.
9. **Uploaded files:** the type is checked from the file's bytes (`sniffMime`), the size is capped at 10 MB, and the server builds the storage path. Files are served only through `/files/[id]` with a workspace check and `Cache-Control: no-store`.
10. **No `Co-Authored-By` line in commits.**

---

# Project Architecture

- **Website:** Next.js 16 App Router in `web/`, with Tailwind 4, Drizzle ORM and Zod.
- **Two modes, chosen in `web/src/db/index.ts` (`cloudMode()`):**
  - **Cloud** (when `DATABASE_URL` is set and `RENT_DATA_DIR` is not):
    - Database: Supabase Postgres, Mumbai `ap-south-1`, through the transaction pooler with `prepare: false`.
    - Sign-in: Supabase Auth with an emailed code (`server/auth.ts`, `proxy.ts`, `app/login`).
    - Files: the private Storage bucket `documents`, reached only with the secret key (`server/files.ts`).
    - Tables are updated at build time by `db/migrate.mjs`, using the session pooler.
  - **Local** (no `DATABASE_URL`, or `RENT_DATA_DIR` set): PGlite in `web/.data`, files in `web/.data/pglite-files`, no sign-in. Tests always run this way.
- **Moving local data to the cloud:** `npm run copy-to-supabase`, or `-- --dry-run` to check without keeping anything. It runs once, into an empty database.
- **Flow:** form → server action (`app/actions.ts`, Zod validation) → command (`server/commands.ts`, business rules and transaction) → page reads through `server/queries.ts`.
- **Balances** are never stored. They are worked out from the ledger (`lib/money.ts`, oldest charge paid first).
- **Auth:**
  - In cloud mode, `getCtx` takes the person from the verified session (`getClaims`) and finds **their** membership.
  - `proxy.ts` is only the first gate that sends signed-out visitors to /login. Pages and actions check the person again on the server.
- **Specs:** `docs/00`–`20`. Decisions are in `docs/16`.
- **Tests:**
  - `npm test` runs the money maths.
  - The browser suites are puppeteer scripts in the session scratchpad. They are **NOT in the repo yet**; moving them into `web/tests/` is a TODO.

---

# Known Pitfalls

### Constants exported from a `"use client"` file are not usable on the server
- **Why it happens:** Next turns client-module exports into references.
- **Correct approach:** put shared constants in `web/src/lib/labels.ts`.
- **Detection:** the value is undefined or strange in a server component.

### Next 16 route and page types
- **Correct approach:** use `PageProps<"/path">` and `RouteContext<"/path">`, and run `npx next typegen` before `tsc`.

### Server action body limit
- **Why it happens:** the default is 1 MB, so uploads fail.
- **Correct approach:** set `experimental.serverActions.bodySizeLimit: "11mb"` in `next.config.ts`.

### Browser cache served a deleted file
- **Why it happens:** `/files/[id]` sent `max-age=3600`, so a deleted document still opened.
- **Correct approach:** send `private, no-store` for every private file.

### The audit details showed UUIDs, raw codes and scaled numbers
- **Why it happens:** the audit `changes` column stores raw command input. The owner saw "meter id b2dd…", "value milli 12000" and "REPAIR".
- **Correct approach:** the history page translates keys and values (`FIELD_NAMES` and `show()` in `app/(app)/history/page.tsx`). Keys that hold IDs are hidden.
- **Detection:** any UUID or ALL_CAPS code visible in the UI.

### Tests that build dates with `toISOString()` break after midnight in India
- **Why it happens:** `toISOString()` is UTC. Between 00:00 and 05:30 IST it gives yesterday, so "18 Aug" became "17 Aug" (2026-09-20).
- **Correct approach:** build `YYYY-MM-DD` from `getFullYear()`, `getMonth()` and `getDate()`. The app uses the workspace time zone (`todayIn` in `server/queries.ts`).

### `innerText` returns CSS-uppercased text
- **Why it happens:** the `Outcome` heading is styled `uppercase`, so `innerText` gives "WHAT HAPPENS WHEN YOU SAVE".
- **Correct approach:** compare in lower case in tests.

### Database links copied from Supabase keep `[YOUR-PASSWORD]` brackets
- **Why it happens:** people replace the words inside the brackets but keep the brackets, so the login fails with `28P01 password authentication failed`.
- **Correct approach:** the password goes in with no brackets. To check `.env.local` without printing secrets, print only booleans (starts with `[`, port, host).

### postgres-js sends a JS string as a JSON string when the parameter is cast `::json`
- **Why it happens:** the parameter type is json, so the string is JSON-encoded again. Postgres then fails with "cannot call json_populate_recordset on a scalar".
- **Correct approach:** cast `$1::text::json`.

### Generated columns can't be inserted
- **Why it happens:** `tenancies.occupancy` is a generated column, so copying `select *` fails.
- **Correct approach:** list the columns from `information_schema.columns` with `is_generated = 'NEVER'`.

### Browser IDs must be checked against the workspace everywhere, including "pick an existing X"
- **What happened (2026-09-20):** `startTenancy` accepted any `tenantId`, so another account's tenant could be linked and read.
- **Fix:** check the ID with `workspace_id = ctx.workspace.id` before using it.
- **How to find more:** grep for `.where(eq(t.X.id` without `workspaceId`.

### Circular import between `ui.tsx` and the action components
- **Correct approach:** shared form pieces (`Outcome`, `Field`) live in `components/form.tsx`, not `ui.tsx`.

### Links that don't look like links
- **Why it happens:** only the tenant name opened a page, and it looked like plain text. The owner thought the page was broken (2026-09-19).
- **Correct approach:** the whole row is a stretched link with a `>` chevron, and names use `linkClass` (docs/20 C-1).

---

# Proven Patterns

### Stretched-link row
- `relative` goes on the row, and `after:absolute after:inset-0` on the main link.
- Buttons and links inside the row get `relative` so they stay clickable.
- See `TenancyRow` in `components/ui.tsx`.

### Dialog form
- `DialogForm` in `components/dialog-form.tsx`: a native `<dialog>` that posts to a server action and returns `{ok}` or `{error, field}`.
- On success it shows `ok` as a toast. Errors show inline under the field named in `field`.

### "What happens when you save"
- The `Outcome` box in `components/form.tsx` sits above the save button on every form that creates money or files (docs/20 C-5).

### File upload
- Order: check the bytes → write the file → insert the row in `run()`. If the insert fails, delete the file.
- See `addDocument` in `server/commands.ts`.
- When a file rides along with another record (an expense receipt), check the file **before** saving the record, so a bad file never leaves a half-done save.

### Plain-word scan
- The scratchpad `scan.mjs` crawls every page and dialog and lists any old word (tenancy, unit, void, outstanding, notice, workspace) or UUID it finds.
- Run it after any change to screen text. Suite `e2e8` includes the same check.

### Cloud test with throw-away accounts
- The scratchpad `cloud-test.mjs` creates accounts with `admin.createUser`, gets a code with `admin.generateLink` (no email is sent), and signs in with `verifyOtp` through `@supabase/ssr`, capturing the cookies.
- It checks that person B can't see person A's data, then deletes both accounts. Deleting rows needs `set_config('app.purge', 'on', true)`.

### Test isolation
- `start-test.sh` starts a server on port 3210 with `RENT_DATA_DIR=<scratch>/testdb` and `NEXT_DIST_DIR=.next-test`.
- Every suite needs a fresh start, because suites load sample data.

---

# Failed Approaches

### Resetting the database by deleting `web/.data`
- **Why it was attempted:** it was a quick way to get a clean test database.
- **Why it failed:** it destroyed the owner's real data. This was a serious mistake.
- **Replacement:** the `RENT_DATA_DIR` test database. The rule is permanent.

### Editing files with `sed` or bash heredocs on Windows paths
- **Why it failed:** a `sed` edit silently did nothing, and a bash heredoc containing quotes broke the command.
- **Replacement:** use the Edit/Write tools, or Python with `assert old in s` before replacing.

---

# Important Decisions

- **D-012, D-014, D-021, D-022:** confirmed by the owner on 2026-09-20.
  - One currency per property.
  - One tenancy per room at a time, which may have several tenants.
  - Each tenancy keeps its own history, and payments clear the oldest charge first.
  - Rent is monthly, with a rent day from 1 to 28.
- **D-030 Hosting region:** Mumbai (`ap-south-1`), confirmed on 2026-09-20.
- **Plain words** (2026-09-20): the owner found "tenancy" confusing. The UI says room and tenant. Code keeps the spec names.

---

# Known Gaps (fix before real multi-user hosting)

These are NEEDS WORK, not bugs yet, because today there is one local user.

- **No roles yet:** every signed-in member is the owner of their own workspace. There are no team invites.
- **`loadPortfolio` loads the whole workspace on each request.** This is fine locally but unbounded. It must become per-page queries (docs/05 §6.1) before hosting.
- **No idempotency key on payments.**
  - Today: the Save button is disabled while saving, and a possible duplicate (same amount and date) is flagged, not blocked.
  - Needed: a client-generated operation ID stored in `sync_ops` (docs/08).
- **No rate limits** on uploads, exports or search.
- **Exports have a date range but no row cap.**
- **Deleted files are purged only when the next upload happens.** A scheduled job is needed.
