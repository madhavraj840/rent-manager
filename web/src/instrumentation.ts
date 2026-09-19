// Runs once when the server starts: open the database now, so the first page doesn't wait for it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb } = await import("./db");
  void getDb().catch(() => undefined); // a real error surfaces on the first request
}
