import type { Metadata } from "next";
import { Download } from "lucide-react";
import { EXPENSE_CATEGORIES, METHODS, label } from "@/lib/labels";
import { loadPortfolio } from "@/server/queries";
import { isDay } from "@/server/reports";
import { ExpenseDialog, VoidExpense, type ExpenseOptions } from "@/components/expense-actions";
import { Card, Chip, Empty, PageHeader, buttonClass, longDate, money, shortDate } from "@/components/ui";

export const metadata: Metadata = { title: "Expenses" };

const control = "h-9 rounded-md border border-line-strong bg-surface px-2.5 font-normal";

// SCR-71 Money › Expenses (F-EXP-1)
export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const sp = await searchParams;
  const p = await loadPortfolio();
  const { ctx, properties, units } = p;
  const from = isDay(sp.from) ? sp.from : ctx.today.slice(0, 8) + "01";
  const to = isDay(sp.to) ? sp.to : ctx.today;
  const prop = typeof sp.property === "string" ? sp.property : "all";

  const list = p.expenses.filter((e) => e.expenseDate >= from && e.expenseDate <= to
    && (prop === "all" || (prop === "general" ? !e.propertyId : e.propertyId === prop)));
  const totals = Map.groupBy(list.filter((e) => e.status === "ACTIVE"), (e) => e.currency);
  const byCategory = [...Map.groupBy(list.filter((e) => e.status === "ACTIVE"), (e) => `${e.currency}|${e.category}`)]
    .map(([k, es]) => ({ currency: k.split("|")[0], category: k.split("|")[1], sum: es.reduce((s, e) => s + e.amountMinor, 0) }))
    .sort((a, b) => b.sum - a.sum);

  const options: ExpenseOptions = {
    today: ctx.today,
    defaultCurrency: ctx.workspace.defaultCurrency,
    properties: properties.map((x) => ({ id: x.id, name: x.name, currency: x.currency })),
    units: units.map((u) => ({ id: u.id, label: u.label, propertyId: u.propertyId })),
  };
  const propName = (id: string | null) => (id ? properties.find((x) => x.id === id)?.name : "General");
  const unitLabel = (id: string | null) => (id ? units.find((u) => u.id === id)?.label : undefined);
  const thisMonth = from === ctx.today.slice(0, 8) + "01" && to === ctx.today;

  return (
    <>
      <PageHeader
        title="Expenses"
        sub={`${longDate(from)} – ${longDate(to)}`}
        actions={
          <>
            <a href={`/export/report/expenses?from=${from}&to=${to}`} className={buttonClass.secondary}><Download size={16} aria-hidden /> CSV</a>
            <ExpenseDialog o={options} propertyId={prop !== "all" && prop !== "general" ? prop : undefined} />
          </>
        }
      />

      <form action="/expenses" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1 font-medium">From<input type="date" name="from" defaultValue={from} className={control} /></label>
        <label className="flex flex-col gap-1 font-medium">To<input type="date" name="to" defaultValue={to} className={control} /></label>
        <label className="flex flex-col gap-1 font-medium">Property
          <select name="property" defaultValue={prop} className={control}>
            <option value="all">All</option>
            <option value="general">General only</option>
            {properties.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <button className={buttonClass.secondary}>Show</button>
      </form>

      {totals.size > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {[...totals].map(([cur, es]) => (
            <div key={cur} className="rounded-lg border border-line bg-surface px-4 py-3">
              <p className="text-[13px] text-fg-2">Total spent{totals.size > 1 && ` · ${cur}`}</p>
              <p className="num text-xl font-semibold">{money(es.reduce((s, e) => s + e.amountMinor, 0), cur)}</p>
            </div>
          ))}
          <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
            <p className="text-[13px] text-fg-2">By category</p>
            <p className="num mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {byCategory.map((c) => <span key={c.currency + c.category}>{label(EXPENSE_CATEGORIES, c.category)} <span className="font-medium">{money(c.sum, c.currency)}</span></span>)}
            </p>
          </div>
        </div>
      )}

      <Card>
        {!list.length ? (
          <Empty action={<ExpenseDialog o={options} />}>{thisMonth ? "No expenses recorded this month." : "No expenses in this period."}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[13px] text-fg-2">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Expense</th>
                  <th className="px-4 py-2.5 font-medium max-md:hidden">Property</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((e) => {
                  const void_ = e.status === "VOID";
                  const where = [propName(e.propertyId), unitLabel(e.unitId)].filter(Boolean).join(" · ");
                  return (
                    <tr key={e.id} className={void_ ? "text-fg-2" : ""}>
                      <td className="num whitespace-nowrap px-4 py-3 align-top">{shortDate(e.expenseDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-medium ${void_ ? "line-through" : ""}`}>{label(EXPENSE_CATEGORIES, e.category)}{e.payee && ` · ${e.payee}`}</span>
                          {void_ && <Chip tone="neutral">VOID</Chip>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1 text-[13px] text-fg-2">
                          <span className="md:hidden">{where} ·</span>
                          {[label(METHODS, e.method), e.reference, e.note, void_ && e.voidReason && `Void: ${e.voidReason}`].filter(Boolean).join(" · ")}
                          {!void_ && (
                            <>
                              <ExpenseDialog o={options} e={e} />
                              <VoidExpense id={e.id} summary={`${label(EXPENSE_CATEGORIES, e.category)} · ${money(e.amountMinor, e.currency)} · ${shortDate(e.expenseDate)}`} />
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top max-md:hidden">{where}</td>
                      <td className={`num whitespace-nowrap px-4 py-3 text-right align-top font-medium ${void_ ? "line-through" : ""}`}>{money(e.amountMinor, e.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
