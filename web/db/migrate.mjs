// Updates the Supabase database tables before each build (cloud mode only).
// Uses DATABASE_URL_MIGRATE (session pooler, port 5432). Local mode (PGlite) migrates itself when the app starts.
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL_MIGRATE;
if (!url || process.env.RENT_DATA_DIR) {
  console.log("db/migrate: no DATABASE_URL_MIGRATE, skipping (local mode).");
  process.exit(0);
}
const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle({ client }), { migrationsFolder: path.join(process.cwd(), "db", "migrations") });
  console.log("db/migrate: database tables are up to date.");
} catch (e) {
  console.error("db/migrate: FAILED:", String(e?.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, "<url>"));
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
