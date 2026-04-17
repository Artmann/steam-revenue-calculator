# Contributing

## Tech stack

- [Remix](https://remix.run/) on Node 20+
- [MongoDB](https://www.mongodb.com/) via the [`esix`](https://www.npmjs.com/package/esix) ORM
- [Tailwind CSS](https://tailwindcss.com/) + a few [shadcn/ui](https://ui.shadcn.com/) primitives
- [Jest](https://jestjs.io/) + Testing Library
- Deployed on [Vercel](https://vercel.com/)

## Local setup

```sh
yarn install
yarn dev
```

The dev server starts at <http://localhost:3000>.

You'll need a MongoDB instance for the `/games` and per-game pages to show data — either a local `mongod` or a free MongoDB Atlas cluster. Without one the homepage still renders, just with no popular games.

## Environment variables

Create a `.env` file at the repo root:

| Variable | Purpose | Example |
|---|---|---|
| `DB_URL` | MongoDB connection string | `mongodb://127.0.0.1:27017/` |
| `DB_DATABASE` | Database name | `steam_revenue` |
| `DB_POOL_SIZE` | Connection pool size (optional, defaults to 10) | `10` |
| `SCRAPE_KEY` | Shared secret required by the scrape + migrate endpoints | any long random string |

The scrape and migrate endpoints return 401 when `SCRAPE_KEY` is unset — that's intentional, not a bug.

## Scripts

```sh
yarn dev         # Remix dev server with HMR
yarn build       # production build
yarn test        # Jest with coverage
yarn typecheck   # tsc --noEmit
npx eslint .     # lint
```

## Project layout

```
app/
  components/    shared UI + shadcn primitives
  db/            MongoDB client + index setup
  games/         fetchGames(), slug helpers, GameDetails type
  models/        esix models (Game)
  revenue/       calculateRevenue(), revenueBreakdown()
  routes/        Remix route modules
  services/      higher-level server code (GameService)
  tests/         jest tests for routes
public/          static assets
data/            local data files (e.g. ignored app IDs)
```

## The revenue formula

The math lives in [`app/revenue/calculate-revenue.ts`](app/revenue/calculate-revenue.ts):

- `calculateRevenue(reviews, price)` applies the Boxleiter multiplier for the review tier and multiplies by price.
- `revenueBreakdown(grossRevenue)` subtracts regional pricing (~9%), discounts (~20%), refunds (~12%), then Steam's 30% cut and 20% VAT.

Unit tests under `app/revenue/` cover the math — keep them green if you touch the formula.

## Data pipeline

Steam game data lives in MongoDB. Two admin endpoints keep it fresh, both gated behind `?key=<SCRAPE_KEY>`:

- `GET /api/scrape-games?key=…&cursor=N` — fetches a small batch of games from Steam's `appdetails` API and upserts them. Paginated via `cursor` and rate-limited to roughly 2 seconds per game; designed to be called on a schedule.
- `GET /api/migrate-games?key=…` — bulk load from a seed JSON file.

Indexes on the `games` collection are created lazily by `ensureIndexes()` in [`app/db/index.ts`](app/db/index.ts) on the first request after a cold start.

## Testing

```sh
yarn test
```

Runs Jest with coverage. New routes should get a smoke test following the pattern in `app/tests/routes/`.

## Deployment

`main` auto-deploys to Vercel. Production is at <https://steam-revenue-calculator.com>.

Notes:

- [`vercel.json`](vercel.json) sets the standard security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- [`server.ts`](server.ts) is the Remix adapter entry used by Vercel's Node runtime.
- Route loaders set their own `Cache-Control` headers; edit the `headers` export on a route to tune caching.
