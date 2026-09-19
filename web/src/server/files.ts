import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { cloudMode, filesDir } from "@/db";
import { supabaseAdmin } from "./auth";

// Where uploaded documents live.
// Cloud mode: a PRIVATE Supabase Storage bucket. Only this server (secret key) can read it; people get files through /files/[id].
// Local mode: a folder next to the local database.

const BUCKET = "documents";
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

let ready: Promise<void> | undefined;
async function bucket() {
  const storage = supabaseAdmin().storage;
  ready ??= (async () => {
    if (!(await storage.getBucket(BUCKET)).error) return;
    const { error } = await storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: TYPES });
    if (error && !/exist/i.test(error.message)) throw error;
  })().catch((e) => { ready = undefined; throw e; });
  await ready;
  return storage.from(BUCKET);
}

const local = (key: string) => path.join(filesDir(), key);

export async function putFile(key: string, bytes: Uint8Array, contentType: string) {
  if (!cloudMode()) {
    await mkdir(path.dirname(local(key)), { recursive: true });
    return writeFile(local(key), bytes);
  }
  const { error } = await (await bucket()).upload(key, bytes, { contentType, upsert: false });
  if (error) throw new Error(`File upload failed: ${error.message}`);
}

export async function getFile(key: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!cloudMode()) return new Uint8Array(await readFile(local(key)));
  const { data, error } = await (await bucket()).download(key);
  if (error || !data) throw new Error(`File download failed: ${error?.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function removeFiles(keys: string[]) {
  if (!keys.length) return;
  if (!cloudMode()) return void (await Promise.all(keys.map((k) => rm(local(k), { force: true }))));
  await (await bucket()).remove(keys);
}
