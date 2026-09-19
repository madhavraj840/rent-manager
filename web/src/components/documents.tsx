import { ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import { restoreDocumentAction } from "@/app/actions";
import { DOC_CATEGORIES, label } from "@/lib/labels";
import type { DocRow } from "@/server/queries";
import { AddDocument, DeleteDocument, type DocTarget } from "./document-actions";
import { Card, Chip, Empty, longDate } from "./ui";

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const daysLeft = (deletedAt: string) => Math.max(0, 30 - Math.floor((Date.now() - Date.parse(deletedAt)) / 86_400_000));

/** SCR-75 Documents for a record. `owners` names records other than the page's own (e.g. a tenant's ID on a tenancy page). */
export function DocumentsCard({ docs, target, owners = {}, readOnly }: {
  docs: DocRow[]; target: DocTarget; owners?: Record<string, string>; readOnly?: boolean;
}) {
  const live = docs.filter((d) => !d.deletedAt);
  const deleted = docs.filter((d) => d.deletedAt);
  return (
    <Card title={`Documents (${live.length})`} action={!readOnly && <AddDocument d={target} />}>
      {!live.length ? (
        <Empty>No documents yet. Use <span className="font-medium text-fg">Add document</span> above for the agreement, ID proof or photos.</Empty>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {live.map((d) => {
            const Icon = d.mimeType === "application/pdf" ? FileText : ImageIcon;
            const name = d.title || d.fileName;
            return (
              <li key={d.id} className="relative flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <Icon size={18} className="shrink-0 text-fg-2" aria-hidden />
                <div className="min-w-0 flex-1">
                  <a href={`/files/${d.id}`} target="_blank" rel="noopener" className="block truncate font-medium text-primary after:absolute after:inset-0">{name}</a>
                  <div className="num truncate text-[13px] text-fg-2">
                    {[label(DOC_CATEGORIES, d.category), owners[d.entityId], size(d.sizeBytes), `added ${longDate(d.createdAt.slice(0, 10))}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {d.sensitive && <Chip tone="neutral">SENSITIVE</Chip>}
                {!readOnly && <div className="relative"><DeleteDocument id={d.id} name={name} /></div>}
                <ExternalLink size={15} className="shrink-0 text-fg-2" aria-label="Opens in a new tab" />
              </li>
            );
          })}
        </ul>
      )}
      {deleted.length > 0 && (
        <details className="border-t border-line text-sm">
          <summary className="cursor-pointer px-4 py-2.5 text-fg-2 hover:text-fg">Recently deleted ({deleted.length})</summary>
          <ul className="divide-y divide-line">
            {deleted.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-fg-2">
                <span className="min-w-0 flex-1 truncate">{d.title || d.fileName} · {daysLeft(d.deletedAt!)} days left</span>
                <form action={restoreDocumentAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <button className="rounded px-1.5 py-0.5 text-[13px] font-medium text-primary hover:bg-surface-2">Restore</button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
