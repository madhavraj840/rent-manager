# Rent Manager — website

Next.js 16 + Drizzle + Postgres. Specs live in `../docs` (start with `README.md` there).

## Run

```
npm install
npm run dev        # http://localhost:3000
```

`npm run dev` rebuilds each page the first time you open it (about 1 s per page) so code changes show up instantly.
To just use the app, run `npm run fast` instead: it builds once, then pages load in about 0.1 s.

First visit opens **Set up your workspace**. On the empty dashboard, **Load sample data** fills in 3 properties and 10 tenancies.

## Data

Until the hosting region is chosen (D-030), the database is an embedded Postgres in `.data/` (D-058).
Delete the `.data` folder to start over. Schema: `src/db/schema.ts` + `db/migrations/*.sql`.

## Code map

| Path | What |
|---|---|
| `src/lib/money.ts` | Rent maths: FIFO allocation, periods, proration (docs/10) |
| `src/server/commands.ts` | Every write: validation, one transaction, version stamp, audit |
| `src/server/queries.ts` | Reads for pages; balances derived from the ledger |
| `src/server/reports.ts` | Reports (docs/13): collections, outstanding, deposits, rent roll, statement; CSV |
| `src/app/actions.ts` | Form handlers (Zod) → commands |
| `src/app/(app)/…` | Pages: dashboard, properties, meters and readings round, tenants, tenancies, move-out, expenses, search, reports |
| `src/app/print/…` | Printable receipt and statement (browser Print → Save as PDF) |
| `src/app/export/…` | CSV downloads |

## Check

```
npm test           # money maths against the worked examples in docs/10
npm run lint
npm run build
```
