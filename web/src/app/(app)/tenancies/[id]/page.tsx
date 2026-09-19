import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, MessageCircle, Phone } from "lucide-react";
import { nextPeriodStart, periodStartFor, runningBalances } from "@/lib/money";
import { METHODS, label } from "@/lib/labels";
import { loadPortfolio, meterViews } from "@/server/queries";
import { MetersCard } from "@/components/meters";
import { Card, Chip, TenancyStatus, buttonClass, longDate, money, paymentContext, shortDate } from "@/components/ui";
import { AddCharge, AddCredit, ChangeRent, EditTenant, EditTerms, GiveNotice, RecordPayment, VoidEntry, WithdrawNotice } from "@/components/tenancy-actions";

export const metadata: Metadata = { title: "Tenancy" };

const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
const waLink = (phone: string | null | undefined, text: string) =>
  phone ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;

// SCR-42 Tenancy detail
export default async function TenancyPage({ params }: PageProps<"/tenancies/[id]">) {
  const { id } = await params;
  const portfolio = await loadPortfolio();
  const { ctx, views } = portfolio;
  const v = views.find((x) => x.tenancy.id === id);
  if (!v) notFound();
  const tn = v.tenancy;
  const cur = tn.currency;
  const b = v.balance;
  const primary = v.people[0];
  const open = tn.status === "ACTIVE" || tn.status === "ENDED";
  const pc = paymentContext(v, ctx);
  const stateOf = new Map(b.charges.map((c) => [c.entry.id, c]));
  const rowById = new Map(v.rows.map((r) => [r.id, r]));
  const history = runningBalances(v.entries).reverse();
  const deposits = v.rows.filter((r) => r.account === "DEPOSIT" && r.kind !== "CHARGE").sort((a, b2) => b2.entryDate.localeCompare(a.entryDate));
  const signature = ctx.userName ?? ctx.workspace.name;

  // Reminder text (12 §5)
  const oldest = b.charges.find((c) => c.remaining > 0);
  const reminder = b.overdue > 0 && b.charges.filter((c) => c.remaining > 0).length > 1
    ? `Hello ${primary?.fullName.split(" ")[0]}, your pending balance for ${v.unit.label} is ${money(b.balance, cur)}, including dues since ${oldest?.entry.description.replace("Rent · ", "")}.\nPlease let me know once paid. Thank you, ${signature}`
    : `Hello ${primary?.fullName.split(" ")[0]}, a gentle reminder that rent of ${money(Math.max(b.balance, 0), cur)} for ${v.unit.label}, ${v.property.name}${oldest ? ` for ${oldest.entry.description.replace("Rent · ", "")}` : ""} is due${oldest?.entry.dueDate ? ` on ${longDate(oldest.entry.dueDate)}` : ""}.\nThank you, ${signature}`;

  const headline = tn.status === "CLOSED" ? "Closed" : b.balance > 0 ? `${money(b.balance, cur)} due` : b.balance < 0 ? `Advance ${money(b.advance, cur)}` : "All paid";

  return (
    <>
      <p className="mb-1 text-sm">
        <Link href={`/properties/${v.property.id}`} className="text-fg-2 hover:text-fg">{v.property.name}</Link>
      </p>

      {tn.status === "ACTIVE" && tn.plannedMoveOutDate && (
        <div className="mb-4 flex flex-wrap items-center gap-x-2 rounded-md border border-due/40 bg-due-soft px-4 py-2.5 text-sm text-due">
          <span className="font-medium">On notice · leaving {longDate(tn.plannedMoveOutDate)}</span>
          <span>(given by the {tn.noticeGivenBy === "LANDLORD" ? "landlord" : "tenant"} on {longDate(tn.noticeGivenOn)})</span>
          <WithdrawNotice tenancyId={tn.id} />
        </div>
      )}

      {tn.status !== "ACTIVE" && (
        <p className="mb-4 rounded-md border border-line bg-surface-2 px-4 py-2.5 text-sm">
          {tn.status === "CLOSED"
            ? <>Closed · moved out on {longDate(tn.movedOutOn)}. This record is read-only.</>
            : <>Moved out on {longDate(tn.movedOutOn)}. {b.balance > 0 ? `The tenant still owes ${money(b.balance, cur)}; record a payment or a write-off to close it.` : "Return the remaining deposit or advance to close it."}</>}
        </p>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{v.unit.label}</h1>
            <p className="text-sm text-fg-2">
              {v.people.map((p, i) => (i === 0 && v.people.length > 1 ? `${p.fullName} (main)` : p.fullName)).join(", ")}
              {primary?.phone && <span className="num"> · {primary.phone}</span>}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`num text-2xl font-semibold tracking-tight ${b.overdue > 0 ? "text-overdue" : ""}`}>{headline}</span>
              <TenancyStatus v={v} />
            </div>
            <p className="num mt-1 text-sm text-fg-2">
              Rent {money(v.rent, cur)} a month, from the {ordinal(tn.cycleDay)}
              {tn.graceDays > 0 && `, ${tn.graceDays} days to pay`}
              {v.nextDue && open && ` · next due ${shortDate(v.nextDue)}`}
            </p>
          </div>
          <dl className="num grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
            <dt className="text-fg-2">Deposit held</dt>
            <dd className="text-right font-medium">{money(b.depositHeld, cur)}</dd>
            {b.depositDue > 0 && (
              <>
                <dt className="text-fg-2">Deposit due</dt>
                <dd className="text-right font-medium text-due">{money(b.depositDue, cur)}</dd>
              </>
            )}
            <dt className="text-fg-2">Since</dt>
            <dd className="text-right">{longDate(tn.startDate)}</dd>
            {tn.leaseEndDate && (
              <>
                <dt className="text-fg-2">Lease ends</dt>
                <dd className={`text-right ${tn.leaseEndDate < ctx.today && tn.status === "ACTIVE" ? "font-medium text-due" : ""}`}>{longDate(tn.leaseEndDate)}</dd>
              </>
            )}
          </dl>
        </div>
        {open && (
          <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
            <RecordPayment p={pc} />
            {b.balance > 0 && (
              <a href={waLink(primary?.phone, reminder)} target="_blank" rel="noreferrer" className={buttonClass.secondary}>
                <MessageCircle size={16} aria-hidden /> Remind
              </a>
            )}
            {primary?.phone && (
              <a href={`tel:${primary.phone.replace(/[^\d+]/g, "")}`} className={buttonClass.secondary}>
                <Phone size={16} aria-hidden /> Call
              </a>
            )}
            <AddCharge p={pc} />
            <AddCredit p={pc} />
            {tn.status === "ACTIVE" && (
              <ChangeRent p={pc} rent={v.rent} cycleDay={tn.cycleDay} nextStart={nextPeriodStart(periodStartFor(ctx.today, tn.cycleDay), tn.cycleDay)}
                chargedStarts={v.rows.filter((r) => r.source === "AUTO" && r.status === "ACTIVE" && r.periodStart).map((r) => r.periodStart!)} />
            )}
            {tn.status === "ACTIVE" && !tn.plannedMoveOutDate && <GiveNotice p={pc} leaseEnd={tn.leaseEndDate} />}
            {tn.status === "ACTIVE" && <Link href={`/tenancies/${tn.id}/move-out`} className={buttonClass.ghost}>Move out</Link>}
          </div>
        )}
      </Card>

      <Card title="Ledger" action={
        <span className="flex gap-1 text-[13px]">
          <Link href={`/print/statement/${tn.id}`} target="_blank" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-fg-2 hover:bg-surface-2 hover:text-fg">
            <FileText size={14} aria-hidden /> Statement
          </Link>
          <a href={`/export/statement/${tn.id}`} className="rounded px-1.5 py-0.5 font-medium text-fg-2 hover:bg-surface-2 hover:text-fg">CSV</a>
        </span>
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-[13px] text-fg-2">
              <tr>
                <th className="px-4 py-2.5 font-medium max-sm:pr-0">Date</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium max-sm:hidden">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {history.map(({ entry: e, running }) => {
                const row = rowById.get(e.id)!;
                const c = stateOf.get(e.id);
                const plus = e.kind === "CHARGE" || e.kind === "REFUND";
                const canVoid = open && !e.voided && !row.settlementId && row.source !== "OPENING";
                const receiptText = `Receipt ${e.receiptNo}: received ${money(e.amount, cur)} on ${longDate(e.entryDate)} for ${v.unit.label}, ${v.property.name}. Thank you, ${signature}`;
                return (
                  <tr key={e.id} className={e.voided ? "text-fg-2" : ""}>
                    <td className="num whitespace-nowrap px-4 py-3 align-top max-sm:pr-0">{shortDate(e.entryDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={e.voided ? "line-through" : ""}>{e.description}</span>
                        {c && !e.voided && (
                          c.state === "PAID" ? <Chip tone="paid">PAID</Chip>
                          : c.overdue ? <Chip tone="overdue">OVERDUE{c.state === "PARTLY_PAID" && ` · ${money(c.remaining, cur)} left`}</Chip>
                          : c.state === "PARTLY_PAID" ? <Chip tone="due">{money(c.remaining, cur)} left</Chip>
                          : <Chip tone="neutral">UNPAID</Chip>
                        )}
                        {e.voided && <Chip tone="neutral">VOID</Chip>}
                        {row.possibleDuplicateOf && !e.voided && <Chip tone="due">POSSIBLE DUPLICATE</Chip>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1 text-[13px] text-fg-2">
                        {[e.method && label(METHODS, e.method), e.receiptNo, row.reference, e.voided && row.voidReason && `Void: ${row.voidReason}`, e.kind === "CHARGE" && e.dueDate && !e.voided && `due ${shortDate(e.dueDate)}`]
                          .filter(Boolean).join(" · ")}
                        {e.receiptNo && (
                          <Link href={`/print/receipt/${e.id}`} target="_blank" className="rounded px-1.5 py-0.5 font-medium underline-offset-2 hover:bg-surface-2 hover:text-fg hover:underline">Receipt</Link>
                        )}
                        {e.receiptNo && !e.voided && (
                          <a href={waLink(primary?.phone, receiptText)} target="_blank" rel="noreferrer" className="rounded px-1.5 py-0.5 font-medium underline-offset-2 hover:bg-surface-2 hover:text-fg hover:underline">Share receipt</a>
                        )}
                        {canVoid && <VoidEntry entryId={e.id} summary={`${e.description} · ${money(e.amount, cur)} · ${shortDate(e.entryDate)}`} receipt={e.receiptNo} />}
                      </div>
                    </td>
                    <td className={`num whitespace-nowrap px-4 py-3 text-right align-top ${e.voided ? "line-through" : plus ? "" : "text-primary"}`}>
                      {plus ? money(e.amount, cur) : `−${money(e.amount, cur)}`}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 text-right align-top font-medium max-sm:hidden">
                      {running < 0 ? `Adv ${money(-running, cur)}` : money(running, cur)}
                    </td>
                  </tr>
                );
              })}
              {!history.length && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-fg-2">No entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={v.people.length > 1 ? "Tenants" : "Tenant"}>
          <ul className="divide-y divide-line text-sm">
            {v.people.map((p, i) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.fullName}{v.people.length > 1 && <span className="font-normal text-fg-2"> · {i === 0 ? "main tenant" : "co-tenant"}</span>}</span>
                  {tn.status !== "CLOSED" && <EditTenant t={p} />}
                </div>
                <div className="num text-[13px] text-fg-2">
                  {[p.phone, p.altPhone, p.email].filter(Boolean).join(" · ") || "No contact details"}
                </div>
                {p.address && <div className="text-[13px] text-fg-2">{p.address}</div>}
                {p.emergencyName && <div className="text-[13px] text-fg-2">Emergency: {p.emergencyName}{p.emergencyPhone && ` · ${p.emergencyPhone}`}</div>}
                {p.notes && <div className="mt-1 whitespace-pre-line text-[13px]">{p.notes}</div>}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Terms" action={tn.status === "ACTIVE" ? <EditTerms p={pc} leaseEnd={tn.leaseEndDate} notes={tn.notes} /> : undefined}>
          <dl className="num grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 px-4 py-3 text-sm">
            <dt className="text-fg-2">Moved in</dt><dd>{longDate(tn.startDate)}</dd>
            {tn.billingStartDate !== tn.startDate && <><dt className="text-fg-2">Billing from</dt><dd>{longDate(tn.billingStartDate)}</dd></>}
            <dt className="text-fg-2">Rent day</dt><dd>{ordinal(tn.cycleDay)} of each month, {tn.graceDays} days to pay</dd>
            <dt className="text-fg-2">Lease ends</dt><dd>{tn.leaseEndDate ? longDate(tn.leaseEndDate) : "Not set"}</dd>
            <dt className="text-fg-2">Deposit agreed</dt><dd>{money(tn.depositAgreedMinor, cur)}</dd>
            <dt className="text-fg-2">Rent history</dt>
            <dd>
              {[...v.revisions].reverse().map((r) => (
                <span key={r.id} className="block">{money(r.rentMinor, cur)} from {longDate(r.effectiveFrom)}{r.reason && r.reason !== "Initial rent" && <span className="text-fg-2"> · {r.reason}</span>}</span>
              ))}
            </dd>
            {tn.notes && <><dt className="text-fg-2">Notes</dt><dd className="whitespace-pre-line">{tn.notes}</dd></>}
          </dl>
        </Card>
      </div>

      {tn.status === "ACTIVE" && (
        <div className="mt-6">
          <MetersCard list={meterViews(portfolio, { unitId: v.unit.id })} ctx={ctx} property={v.property} units={[v.unit]} unitId={v.unit.id} />
        </div>
      )}

      {deposits.length > 0 && (
        <Card title="Deposit" className="mt-6">
          <ul className="divide-y divide-line text-sm">
            {deposits.map((r) => (
              <li key={r.id} className={`flex justify-between gap-3 px-4 py-3 ${r.status === "VOID" ? "text-fg-2" : ""}`}>
                <span>
                  <span className={r.status === "VOID" ? "line-through" : ""}>{r.description}</span>
                  <span className="block text-[13px] text-fg-2">
                    {[longDate(r.entryDate), label(METHODS, r.method), r.receiptNumber, r.status === "VOID" && "VOID"].filter(Boolean).join(" · ")}
                    {open && r.status === "ACTIVE" && r.kind === "PAYMENT" && r.method !== "OPENING_BALANCE" && !r.settlementId && (
                      <> <VoidEntry entryId={r.id} summary={`${r.description} · ${money(r.amountMinor, cur)}`} receipt={r.receiptNumber ?? undefined} /></>
                    )}
                  </span>
                </span>
                <span className={`num font-medium ${r.status === "VOID" ? "line-through" : ""}`}>{r.kind === "REFUND" ? "−" : ""}{money(r.amountMinor, cur)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
