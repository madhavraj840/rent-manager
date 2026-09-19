import type { NextRequest } from "next/server";
import { loadPortfolio } from "@/server/queries";
import { REPORTS, buildReport, csvResponse, isDay, slug, toCsv, type ReportType } from "@/server/reports";

export async function GET(req: NextRequest, ctx: RouteContext<"/export/report/[type]">) {
  const { type } = await ctx.params;
  if (!(type in REPORTS)) return new Response("Unknown report", { status: 404 });
  const p = await loadPortfolio();
  const sp = req.nextUrl.searchParams;
  const from = isDay(sp.get("from")) ? sp.get("from")! : p.ctx.today.slice(0, 8) + "01";
  const to = isDay(sp.get("to")) ? sp.get("to")! : p.ctx.today;
  const table = buildReport(p, type as ReportType, from, to);
  const range = type === "collections" ? `${from}_${to}` : p.ctx.today;
  return csvResponse(toCsv(table), `${slug(p.ctx.workspace.name)}_${type}_${range}.csv`);
}
