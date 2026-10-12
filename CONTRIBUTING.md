# Contributing

## Tech stack

- [React Router 7](https://reactrouter.com/) (Vite) served by [Nitro](https://nitro.build/), on Node 22+
- [Vercel Workflow SDK](https://workflow-sdk.dev/) for durable background work (`workflows/`, `server/routes/`)
- [MongoDB](https://www.mongodb.com/) via the [`esix`](https://www.npmjs.com/package/esix) ORM
- [Tailwind CSS 4](https://tailwindcss.com/) (configured via `@config` in `app/tailwind.css`, still using `tailwind.config.ts`) + a few [shadcn/ui](https://ui.shadcn.com/) primitives
- [Vitest](https://vitest.dev/) + Testing Library, with [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server) for integration tests
- Deployed on [Vercel](https://vercel.com/)

## Local setup

Requires Node 22+, pnpm and Docker. The full steps are in the README's [Local development](README.md#local-development) section:

```sh
docker compose up -d mongo
cp .env.template .env.local
pnpm install
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity pnpm seed:local
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity pnpm dev
```

`pnpm dev` prints the local URL when it starts.

## Environment variables

Copy `.env.template` to `.env.local` and fill in local values only.

`pnpm dev` loads `.env` and then `.env.local`. If a `.env` points at production, it is loaded too, so always set `DB_URL` and `DB_DATABASE` inline as shown above.

| Variable | Purpose | Example |
|---|---|---|
| `DB_URL` | MongoDB connection string | `mongodb://127.0.0.1:27017/` |
| `DB_DATABASE` | Database name | `steam_revenue` |
| `DB_POOL_SIZE` | Connection pool size (optional, defaults to 10). esix reads `DB_MAX_POOL_SIZE` and falls back to `DB_POOL_SIZE` | `10` |
| `SCRAPE_KEY` | Shared secret required by the scrape, compute-stats and migrate endpoints (`?key=`) and by `POST /api/workflows/health` (`x-scrape-key` header) | any long random string |
| `STEAM_API_KEY` | Steam Web API key, needed by `/api/scrape-games` | your Steam Web API key |

The key-gated endpoints return 401 when `SCRAPE_KEY` is unset — that's intentional, not a bug.

## Scripts

```sh
pnpm dev             # Vite dev server with HMR
pnpm build           # Vite + Nitro production build to build/
pnpm start           # node build/server/index.mjs
pnpm test            # Vitest (no coverage)
pnpm test:watch      # Vitest in watch mode
pnpm typecheck       # react-router typegen && tsc
pnpm seed:local      # seed the local Docker MongoDB
pnpm parity:capture  # capture every route of a running build: <url> <name>
pnpm parity:compare  # compare two captures: <a> <b>
pnpm workflow:web    # local workflow run inspector
```

## Project layout

```
app/
  components/    shared UI + shadcn primitives
  db/            MongoDB client + index setup
  games/         fetchGames(), slug helpers, GameDetails type
  models/        esix models (Game)
  revenue/       calculateRevenue(), revenueBreakdown()
  routes/        React Router route modules (flat-routes file convention; app/routes.ts)
  services/      higher-level server code (GameService)
  tests/         Vitest route tests; tests/integration/ runs against in-memory MongoDB
server/          Nitro entry (ssr.ts) and Nitro routes (routes/)
workflows/       Workflow SDK workflows
scripts/         local seed and parity tools
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

- `GET /api/scrape-games?key=…&cursor=N` — pages through Steam's game list (`IStoreService/GetAppList`, needs `STEAM_API_KEY`) 1000 games at a time and upserts them using `IStoreBrowseService/GetItems`. Start with `cursor=0` (which also syncs the tag list) and call again with the returned `nextCursor` until it is `0`.
- `GET /api/compute-stats?key=…` — recomputes per-tag market stats. Run it after a full scrape pass.
- `GET /api/migrate-games?key=…` — bulk load from a seed JSON file.

Indexes on the `games` collection are created lazily by `ensureIndexes()` in [`app/db/index.ts`](app/db/index.ts) on the first request after a cold start.

## Testing

```sh
pnpm test
```

Runs Vitest. Integration tests start their own in-memory MongoDB, so no running database is needed. New routes should get a smoke test following the pattern in `app/tests/routes/`.

## Deployment

`main` auto-deploys to Vercel. Production is at <https://steam-revenue-calculator.com>.

Notes:

- [`vercel.json`](vercel.json) sets the standard security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- [`server/ssr.ts`](server/ssr.ts) is the Nitro entry that serves React Router. On Vercel, Nitro's Vercel preset produces `.vercel/output`.
- The Workflow SDK needs "Automatically expose System Environment Variables" enabled in the Vercel project settings.
- Route loaders set their own `Cache-Control` headers; edit the `headers` export on a route to tune caching.
