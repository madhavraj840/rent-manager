import Link from "next/link";
import { totals, type Cell, type Table } from "@/server/reports";
import { longDate, money } from "./ui";

const isDate = (c: Cell): c is string => typeof c === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c);

function show(c: Cell) {
  if (c == null || c === "") return "—";
  if (typeof c === "object") return money(c.minor, c.currency);
  if (isDate(c)) return longDate(c);
  return String(c);
}

/** Renders a report Table; the first cell links to the row's page when `href` is set. */
export function DataTable({ table, empty = "Nothing to show.", total = true }: { table: Table; empty?: string; total?: boolean }) {
  const sums = total ? totals(table) : [];
  const right = (i: number) => table.columns[i].money || table.columns[i].right;
  if (!table.rows.length) return <p className="px-4 py-10 text-center text-sm text-fg-2">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="num w-full text-sm">
        <thead className="border-b border-line text-left text-[13px] text-fg-2">
          <tr>
            {table.columns.map((c, i) => (
              <th key={c.label} className={`whitespace-nowrap px-3 py-2.5 font-medium first:pl-4 last:pr-4 ${right(i) ? "text-right" : ""}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {table.rows.map((row, r) => (
            <tr key={r} className="hover:bg-surface-2">
              {row.map((c, i) => (
                <td key={i} className={`px-3 py-2.5 first:pl-4 last:pr-4 ${table.columns[i].wrap ? "min-w-32" : "whitespace-nowrap"} ${right(i) ? "text-right" : ""}`}>
                  {i === 0 && table.href?.[r] ? <Link href={table.href[r]!} className="font-medium hover:underline">{show(c)}</Link> : show(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {sums.length > 0 && (
          <tfoot className="border-t-2 border-line-strong font-semibold">
            {sums.map(({ currency, sums: s }) => (
              <tr key={currency}>
                {table.columns.map((c, i) => (
                  <td key={i} className={`whitespace-nowrap px-3 py-2.5 first:pl-4 last:pr-4 ${right(i) ? "text-right" : ""}`}>
                    {i === 0 ? `Total${sums.length > 1 ? ` · ${currency}` : ""}` : c.money ? money(s[i], currency) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  );
}
