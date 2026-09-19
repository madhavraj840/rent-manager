// Copies your local data (web/.data) into Supabase, once.
//
//   1. Stop the app first (Ctrl + C in the terminal running "npm run dev").
//   2. Run:  npm run copy-to-supabase
//      or, to sign in with a different email than the one you typed at setup:
//            npm run copy-to-supabase -- --email you@example.com
//
// What it does:
//   - Creates your Supabase sign-in account with the SAME id as your local profile, so every record keeps its owner.
//   - Copies every table in one transaction. If anything fails, nothing is copied.
//   - Uploads your documents to the private "documents" bucket.
// It refuses to run if Supabase already has an account (workspace) in it, so it can't copy twice.
// Your local data is only read, never changed.

import path from "node:path";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

// Parents before children, so every link points to a row that already exists.
const TABLES = [
  "profiles", "workspaces", "workspace_counters", "memberships", "properties", "units", "tenants", "tenancies", "tenancy_parties",
  "rent_revisions", "settlements", "meters", "meter_readings", "ledger_entries", "expenses", "documents", "audit_events",
];

const env = (k) => process.env[k] || (console.error(`Missing ${k} in web/.env.local`), process.exit(1));
const hide = (s) => String(s).replace(/postgres(ql)?:\/\/\S+/g, "<url>");
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const argEmail = arg("--email");
// --dry-run: copies inside a transaction, then undoes it. No sign-in account, no file uploads. For checking only.
const dryRun = process.argv.includes("--dry-run");
class DryRunDone extends Error {}

const dataDir = arg("--from") ?? path.join(process.cwd(), ".data", "pglite");
const filesDir = `${dataDir}-files`;
const local = await PGlite.create({ dataDir, extensions: { btree_gist } });
await migrate(drizzle({ client: local }), { migrationsFolder: path.join(process.cwd(), "db", "migrations") });

const cloud = postgres(env("DATABASE_URL_MIGRATE"), { max: 1, onnotice: () => {} });
const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

try {
  const [{ n }] = await cloud`select count(*)::int as n from app.workspaces`;
  if (n > 0) throw new Error("Supabase already has data in it. Nothing was copied (this script only runs once, into an empty database).");

  const profiles = (await local.query("select id, email, full_name from app.profiles")).rows;
  if (!profiles.length) throw new Error("Your local database has no account yet. Nothing to copy.");
  if (profiles.length > 1 && argEmail) throw new Error("--email only works when there is one local profile.");

  // 1. Sign-in accounts with the same ids as the local profiles.
  for (const p of dryRun ? [] : profiles) {
    const email = (argEmail ?? p.email).trim().toLowerCase();
    const { data: list, error: le } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (le) throw le;
    const same = list.users.find((u) => u.email?.toLowerCase() === email);
    if (same && same.id !== p.id) {
      // Signed in once before the copy: that account is empty (Supabase has no workspaces), so replace it.
      const { error } = await admin.auth.admin.deleteUser(same.id);
      if (error) throw error;
    }
    if (!same || same.id !== p.id) {
      const { error } = await admin.auth.admin.createUser({ id: p.id, email, email_confirm: true, user_metadata: { full_name: p.full_name } });
      if (error) throw error;
    }
    console.log(`Sign-in account ready for ${email.replace(/(.).+(@.*)/, "$1***$2")}`);
    p.signInEmail = email;
  }

  // 2. All tables, in one transaction.
  const counts = {};
  await cloud.begin(async (tx) => {
    const [{ seq }] = await tx`select coalesce(max(change_seq), 1)::text as seq from app.workspace_counters`;
    const localSeq = (await local.query("select coalesce(max(change_seq), 1)::text as seq from app.workspace_counters")).rows[0].seq;
    await tx`select set_config('app.change_seq', ${String(Math.max(Number(seq), Number(localSeq)))}, true)`;
    for (const table of TABLES) {
      const json = (await local.query(`select coalesce(json_agg(x), '[]')::text as j from app.${table} x`)).rows[0].j;
      const rows = JSON.parse(json).length;
      // Columns the database calculates itself (e.g. tenancies.occupancy) are left out; they fill in on insert.
      const cols = (await tx`select column_name from information_schema.columns
        where table_schema = 'app' and table_name = ${table} and is_generated = 'NEVER' order by ordinal_position`).map((c) => `"${c.column_name}"`).join(", ");
      if (rows) await tx.unsafe(`insert into app.${table} (${cols}) select ${cols} from json_populate_recordset(null::app.${table}, $1::text::json)`, [json]);
      counts[table] = rows;
    }
    if (dryRun) {
      for (const table of TABLES) {
        const [{ c }] = await tx.unsafe(`select count(*)::int as c from app.${table}`);
        if (c !== counts[table]) throw new Error(`Dry run: ${table} has ${c} rows in Supabase, expected ${counts[table]}`);
      }
      throw new DryRunDone();
    }
    // The sign-in email becomes the account email.
    for (const p of profiles) {
      await tx`update app.profiles set email = ${p.signInEmail} where id = ${p.id}`;
      await tx`update app.memberships set email = ${p.signInEmail} where user_id = ${p.id}`;
    }
  }).catch((e) => { if (!(e instanceof DryRunDone)) throw e; });
  console.log(dryRun ? "Dry run OK (nothing was kept):" : "Copied:", Object.entries(counts).filter(([, c]) => c).map(([t, c]) => `${t} ${c}`).join(", "));

  if (dryRun) throw new DryRunDone();
  // 3. Documents into the private bucket.
  const storage = admin.storage;
  if ((await storage.getBucket("documents")).error) {
    const { error } = await storage.createBucket("documents", {
      public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    });
    if (error && !/exist/i.test(error.message)) throw error;
  }
  const docs = (await local.query("select storage_path, mime_type from app.documents")).rows;
  let up = 0, missing = 0;
  for (const d of docs) {
    let bytes;
    try { bytes = await readFile(path.join(filesDir, d.storage_path)); } catch { missing++; continue; }
    const { error } = await storage.from("documents").upload(d.storage_path, bytes, { contentType: d.mime_type, upsert: true });
    if (error) throw new Error(`Upload failed for one document: ${error.message}`);
    up++;
  }
  console.log(`Documents uploaded: ${up}${missing ? ` (${missing} file(s) were missing on this computer)` : ""}`);
  console.log("Done. Sign in on the website with your email to see your data.");
} catch (e) {
  if (!(e instanceof DryRunDone)) {
    console.error("STOPPED:", hide(e?.message ?? e));
    process.exitCode = 1;
  }
} finally {
  await cloud.end({ timeout: 5 });
  await local.close();
}
