import { readFile } from "node:fs/promises";
import { docFile, openDocument } from "@/server/commands";
import { requireCtx } from "@/server/queries";

// Serves an uploaded document to the workspace member (F-DOC-2). Opens in the browser's own image/PDF viewer.
export async function GET(_: Request, { params }: RouteContext<"/files/[id]">) {
  const ctx = await requireCtx();
  const d = await openDocument(ctx, (await params).id);
  if (!d) return new Response("Document not found", { status: 404 });
  return new Response(await readFile(docFile(d.storagePath)), {
    headers: {
      "Content-Type": d.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(d.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store", // a deleted file must stop opening at once
    },
  });
}
