# Personal Expense Tracker

Mobile-first expense tracker with an AI receipt scanner.

```
├── api/   NestJS · MongoDB Atlas · Gemini Vision      (Steps 1–3)
└── web/   Angular 22 · Tailwind 4 · Reactive Forms    (Steps 4–5)
```

## Quick start

Two terminals.

**API** — needs no Atlas account to try it out:

```bash
cd api
npm install
npm run start:memory     # in-memory replica set + stubbed receipt scanner
```

For the real thing, `cp .env.example .env`, fill in `MONGODB_URI` and
`GEMINI_API_KEY` (both free — see [api/README.md](api/README.md)), then `npm run start:dev`.

**Web:**

```bash
cd web
npm install
npm start                # http://localhost:4200
```

`ng serve` proxies `/api` to `localhost:3000` (see `proxy.conf.json`), so there is no
CORS setup in development and no API hostname baked into the bundle.

Open the app in your browser's device toolbar at iPhone/Android width — it is designed
for a phone and renders as one on a desktop.

## Tests

```bash
cd api && npm test       # 100 tests: unit + integration against a real MongoDB
cd web && npm test       # 108 tests: utils, pipe, form, charts, transactions
```

The API integration suite runs against a real MongoDB and asserts that a spend can
always be recorded, that every filter and aggregation agrees with the ledger, that money
maths never drifts, and — critically — that one user can never read, edit or delete
another user's data even knowing the exact document id.

## Deploying

See **[DEPLOY.md](DEPLOY.md)** — Angular on Vercel, NestJS on Render, step by step.

## Status

| Step | | |
|---|---|---|
| 1 | Mongoose schemas + database module | ✅ |
| 2 | Gemini Vision receipt scanner | ✅ |
| 3 | Accounts + transactions + ACID transfers + analytics | ✅ |
| 4 | Angular shell, services, interceptors, transaction form | ✅ |
| 5 | Filterable transactions list, dashboard + charts | ✅ |
| 6 | Removed accounts — simplified to a pure spending log | ✅ |
| 7 | Email/password auth (JWT) + deployment configs | ✅ |

## Screens

| Route | What it does |
|---|---|
| `/` | Dashboard — total spend, biggest spend, daily trend, category donut, cash vs online |
| `/transactions` | Filterable history grouped by day, cash/online badges, expandable line items |
| `/add`, `/edit/:id` | Add a spend: amount, payment mode, category, optional line items, or scan a receipt |
| `/settings` | Shortcuts and how it works |

## Model

This is a **spending log, not a double-entry ledger**. There are no accounts and no
balances: you record what you spent and how you paid for it. Each transaction is one
self-contained document, so every write is a single atomic insert — and nothing can
ever refuse to record what you actually spent.

`TRANSFER`, account balances and the multi-document transaction machinery were removed
deliberately. If you ever want "how much cash do I have left", that is a rebuild, not a
toggle.

## Charts

Hand-rolled inline SVG rather than a charting library — three simple charts did not
justify the dependency on a mobile bundle, and it gives exact control over mark
geometry and touch targets.

The palette is **validated, not eyeballed**: it clears the lightness band, chroma
floor, colour-vision-deficiency separation (worst adjacent ΔE 9.1, target ≥8) and the
normal-vision floor (worst ΔE 19.6, floor ≥15) on a white surface. Three slots fall
below 3:1 contrast, so every chart using them ships visible labels beside the mark —
the donut's legend lists each category with its amount, and nothing is identified by
colour alone. See `web/src/app/shared/chart-palette.ts`.
