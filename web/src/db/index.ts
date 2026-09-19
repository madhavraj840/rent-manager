import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

// ponytail: embedded Postgres (PGlite) in web/.data until the Supabase project exists (D-030, D-058).
// Swapping to Supabase = replace this file with drizzle-orm/postgres-js; queries and migrations stay the same.
export type DB = PgliteDatabase<typeof schema>;

// RENT_DATA_DIR lets tests use their own database and never touch yours.
const dataDir = () => process.env.RENT_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
/** Uploaded documents, next to the database so tests stay isolated too. */
export const filesDir = () => `${dataDir()}-files`;

const g = globalThis as unknown as { __db?: Promise<DB> };

async function open(): Promise<DB> {
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
