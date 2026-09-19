import type { NextRequest } from "next/server";
import { loadPortfolio } from "@/server/queries";
import { csvResponse, slug, statement, toCsv } from "@/server/reports";

export async function GET(_: NextRequest, ctx: RouteContext<"/export/statement/[id]">) {
  const { id } = await ctx.params;
  const p = await loadPortfolio();
  const v = p.views.find((x) => x.tenancy.id === id);
  if (!v) return new Response("Not found", { status: 404 });
  return csvResponse(toCsv(statement(v)), `${slug(v.unit.label)}_${slug(v.people[0]?.fullName ?? "tenant")}_statement_${p.ctx.today}.csv`);
}
