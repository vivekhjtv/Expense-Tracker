# Expense Tracker API

NestJS + MongoDB Atlas + Gemini Vision. Steps 1–2 delivered: schemas, DB module, receipt scanner.

## Setup

```bash
npm install
cp .env.example .env      # then fill in the two real values below
npm run start:dev
```

### 1. MongoDB Atlas (free M0)
Create a free cluster at https://cloud.mongodb.com, add a database user, allow your IP
under Network Access, then copy the connection string into `MONGODB_URI`.

Any MongoDB works — a replica set is no longer required, since every write is a single
document.

### 2. Gemini API key (free)
Get one at https://aistudio.google.com/apikey → paste into `GEMINI_API_KEY`.
The free tier covers `gemini-2.5-flash` with generous daily limits — no billing account needed.

`GEMINI_THINKING_BUDGET` defaults to `0` (thinking off) for the fastest, cheapest scan.
Raise it to `512`, or set `-1` for dynamic, if you hit unusually dense or crumpled bills.

## Endpoints

All routes are scoped to the acting user, resolved by `UserContextMiddleware`
(`x-user-id` header, falling back to `DEFAULT_USER_ID` until auth is added).

### Receipts
| | |
|---|---|
| `POST /api/receipts/scan` | multipart `image` → structured receipt. Nothing persisted. |

### Transactions
| | |
|---|---|
| `POST /api/transactions` | Record a spend (or income). |
| `GET /api/transactions` | Filterable, paginated ledger (see query params below). |
| `GET /api/transactions/:id` | One transaction with populated accounts. |
| `PATCH /api/transactions/:id` | Edit any field. |
| `DELETE /api/transactions/:id` | Delete it. |

Ledger query params: `range` (`TODAY`/`YESTERDAY`/`THIS_WEEK`/`THIS_MONTH`/`LAST_MONTH`/`THIS_YEAR`/`ALL`/`CUSTOM`),
`from`, `to`, `tzOffset`, `paymentMode`, `type`, `category`, `search`,
`page`, `limit`, `sortBy`, `sortDir`.

**Always send `tzOffset`** from the client as `-new Date().getTimezoneOffset()` (330 for IST).
Day boundaries are otherwise computed in UTC, which silently drops late-night spends from "Today".

### Analytics
| | |
|---|---|
| `GET /api/analytics/dashboard` | Everything below in one round trip — use this on mobile. |
| `GET /api/analytics/summary` | Spend, income, cash/online split, largest spend, top category. |
| `GET /api/analytics/daily-trend` | Daily spend, zero-filled so the chart has no gaps. |
| `GET /api/analytics/categories` | Donut slices, sorted biggest-first. |
| `GET /api/analytics/payment-modes` | Cash vs Online, always both slices. |

## Tests

```bash
npm test               # unit + integration
npm run test:unit      # money, image sniffing, receipt normalisation (no I/O)
npm run test:integration   # full HTTP stack on a real in-memory replica set
```

The integration suite spins up an actual replica set and asserts the guarantees the
ledger depends on: transfer atomicity, edit/delete balance reversal, rollback leaving
no orphan row when a guard rejects, and no lost updates across 20 concurrent writes.

## Indexes

`autoIndex` is disabled. `IndexInitializer` builds the schema indexes inside
`onApplicationBootstrap`, awaited, so they exist before the server accepts its first
request. Mongoose's `autoIndex` builds in the background — leaving a window where the
unique constraints (one account name per user, one default account per user) are not
yet enforced — and is conventionally off in production, where it would mean those
constraints are never created at all.

## Conventions

- **Money**: never use `+`/`-` on a money value. Use `common/utils/money.util.ts`, which
  does the arithmetic in integer paise. `0.1 + 0.2` drift has no place in a ledger.
- **Amounts are always positive.** Direction is carried by `Transaction.type`, never by sign.
- **No accounts, no balances.** Each transaction is a self-contained document, so
  create/update/delete are single atomic writes with no sessions and no side effects.
- **Nothing may refuse a spend.** Validation checks shape (amount > 0, valid date,
  valid payment mode) and nothing else. There is no rule that can stop you recording
  what actually happened.

