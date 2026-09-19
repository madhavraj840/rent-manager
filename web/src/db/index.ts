import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/pglite/migrator";
import postgres from "postgres";
import * as schema from "./schema";

// Two modes (D-058, D-030):
// - cloud: Supabase Postgres in Mumbai, when DATABASE_URL is set. Tables are updated at build time (db/migrate.mjs).
// - local: embedded Postgres (PGlite) in web/.data. Used when DATABASE_URL is missing, or when RENT_DATA_DIR is set (tests).
// Both use the same Drizzle queries, so the rest of the app doesn't know which one it talks to.
export type DB = PgliteDatabase<typeof schema>;

/** True when the app runs on Supabase (database, sign-in, file storage). */
export const cloudMode = () => !process.env.RENT_DATA_DIR && !!process.env.DATABASE_URL;

// RENT_DATA_DIR lets tests use their own database and never touch yours.
const dataDir = () => process.env.RENT_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
/** Uploaded documents in local mode, next to the database so tests stay isolated too. */
export const filesDir = () => `${dataDir()}-files`;

const g = globalThis as unknown as { __db?: Promise<DB> };

async function open(): Promise<DB> {
  if (cloudMode()) {
    // Transaction pooler (port 6543): prepared statements are not supported there.
    const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 5, idle_timeout: 20 });
    // ponytail: the postgres-js and PGlite Drizzle databases share one query API; the cast keeps a single DB type.
    return drizzlePg({ client, schema }) as unknown as DB;
  }
  mkdirSync(dataDir(), { recursive: true });
  const client = await PGlite.create({
    dataDir: dataDir(),
    extensions: { btree_gist },
  });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "db", "migrations") });
  return db;
}

export const getDb = () => (g.__db ??= open());
export * as t from "./schema";
