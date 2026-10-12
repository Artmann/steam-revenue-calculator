# React Router 7 Migration Design

## Goal

Move the site from Remix 1.19 to React Router 7 (Vite + Nitro) so the Vercel Workflow SDK can run inside it. Pages, URLs, SEO metadata and caching headers must stay identical. The workflow-based scraper rebuild is a separate project, built on top of this one.

## Scope

In scope:

- Package manager: yarn → pnpm.
- Framework: Remix 1.19 → React Router 7, with Vite builds and Nitro as the server, deployed to Vercel.
- Workflow SDK wiring (`workflow` package and Vite plugin), proven by one trivial health workflow.
- Tests: Jest/ts-jest → Vitest; mongo-mock → mongodb-memory-server.
- Data: MongoDB driver 3.6 → 6.x; esix 3.2.1 → 5.7 (same `findBy` / `create` API, `mongodb ^6` peer).
- Styling: Tailwind 3 → Tailwind 4.
- Local development database: MongoDB in Docker.
- CI: pnpm on Node 22, running typecheck, build and test.
- Remove deprecated or unused dependencies: all `@remix-run/*` packages, `@vercel/node`, `source-map-support`, `@types/source-map-support`, `@types/mongodb`, `mongo-mock`, `jest`, `ts-jest`, `jest-environment-jsdom`, `@types/jest`. `isbot` moves from 3 to 5.

Out of scope:

- Scraper behaviour, scheduling and the known scraper defects (next project).
- Visual or content changes to any page.
- Data changes in the production database.

## Constraints

- Nothing in this work reads from or writes to the production database. `.env` currently points at production; `.env.template` and local development point at the Docker database instead.
- Never print, log or commit `STEAM_API_KEY` or other secrets.
- Code style: no semicolons, single quotes, 2-space indent.
- Ships as one branch and one PR, with one commit (or a small group) per stage. Every stage commit leaves `pnpm typecheck`, `pnpm build` and `pnpm test` passing.

## Architecture

### Build and runtime

- `react-router.config.ts`: `ssr: true`, `buildDirectory: 'build'`, `future.v8_viteEnvironmentApi: true`.
- `vite.config.ts` loads its plugins in this order:
  1. `@mdx-js/rollup`, which runs before React Router.
  2. `reactRouter()`.
  3. `nitro()`, with `serverDir: './server'`, output to `build`, `build/server` and `build/client`, and an SSR input of `./server/ssr.ts`.
  4. `workflow({ dirs: ['workflows'] })`.

  It also uses `vite-tsconfig-paths`, so `~/` still resolves to `app/`.
- `server/ssr.ts` default-exports `{ fetch }`, built from `createRequestHandler` over `virtual:react-router/server-build`.
- Nitro's Vercel preset is used on Vercel, where it is detected automatically. Locally, the app runs with `node build/server/index.mjs`.
- Removed: `server.ts`, `remix.config.js`, `remix.env.d.ts` and `public/build`. The `.gitignore` entries for `api/index.js*` are replaced with `/build` and `/.output`.
- `vercel.json` keeps only the existing security `headers` block.
- Scripts:
  - `dev`: `vite dev`
  - `build`: `vite build`
  - `start`: `node build/server/index.mjs`
  - `test`: `vitest run`
  - `test:watch`: `vitest`
  - `typecheck`: `react-router typegen && tsc`
  - `workflow:web`: `workflow web`
- Engines: Node `>=22`. `packageManager` pins a pnpm version.

### Routes

- `app/routes.ts` uses `flatRoutes()` from `@react-router/fs-routes`. That keeps the current file naming, so every URL stays the same. This includes `ads[.]txt`, `robots[.]txt`, `sitemap[.]xml`, `sitemap-tags[.]xml`, `app.$id.$slug` and the `.mdx` blog post.
- Imports from `@remix-run/node` and `@remix-run/react` move to `react-router`.
  - `V2_MetaFunction`, `LoaderFunction` and similar types move to the generated `Route.*` types, where that is straightforward. Otherwise they become React Router's `MetaFunction` / `LoaderFunctionArgs`.
  - `json(data)` becomes a plain return of `data`.
  - `json(data, init)` with a status or headers becomes `data(value, init)` from `react-router`, or `Response.json` in resource routes.
- Every `headers` export and every Cache-Control value stays exactly as it is today.
- `app/root.tsx`:
  - `cssBundleHref` and `LiveReload` are removed.
  - CSS imports use `?url`.
  - It gains a `Layout` export and a root `ErrorBoundary`. The boundary renders a plain error page, with the response status for route errors and 500 for anything else.
- `entry.server.tsx` and `entry.client.tsx` become their React Router 7 equivalents. Bot handling stays the same, using `isbot` 5's named export.
- The MDX blog post is compiled by `@mdx-js/rollup` and stays a route module.

### Workflow scaffolding

- `workflows/health.ts` holds a single `"use workflow"` function, which calls one `"use step"` that returns a timestamp.
- `server/routes/api/workflows/health.post.ts` starts the workflow. It requires the `SCRAPE_KEY` header (`x-scrape-key`) and returns 401 without it.
- The health workflow exists only to prove that the SDK builds, deploys and shows up in the Vercel Workflows dashboard. The scraper project replaces it.
- Vercel prerequisite: enable "Automatically expose System Environment Variables" on the project. Without it, the Workflow SDK falls back to the Local World and fails.

### Data

- `app/db/index.ts`:
  - Moves to driver 6.
  - `poolSize` becomes `maxPoolSize`; `useNewUrlParser` and `useUnifiedTopology` are removed.
  - `getCollection` keeps its signature.
  - Fix while here: `indexesEnsured` is now set only after `ensureIndexes` succeeds, and concurrent callers share one in-flight promise.
- `app/models/game.ts` keeps using esix's `BaseModel`, now version 5.7. If any driver 3 API is used elsewhere, it is updated:
  - `insert` / `update` result shapes
  - `ObjectId` import
  - `bulkWrite` result fields
  - `findOneAndUpdate` return value
- `docker-compose.yml` adds a `mongo:7` service on port 27017, with a named volume.
- `.env.template` defaults to `DB_URL=mongodb://127.0.0.1:27017/` and `DB_DATABASE=steam-revenue-calculator`.
- The README gains a short "Local development" section: start Docker Mongo, copy `.env.template`, then seed the database with the deterministic `seed:local` script, which refuses non-local `DB_URL`s.

### Styling

- Tailwind 4 via `@tailwindcss/vite`.
- `app/tailwind.css` becomes `@import 'tailwindcss'` with `@config '../tailwind.config.ts'`. Keeping the JS config avoids rewriting the theme, which has container settings, colour variables, animations and the `tailwindcss-animate` plugin.
- Utility classes renamed in v4 are updated wherever they appear, so the rendered result is the same. Examples: `shadow-sm` → `shadow-xs`, `rounded` → `rounded-sm`, `outline-none` → `outline-hidden`, and the default `ring` width. The official `@tailwindcss/upgrade` tool does the first pass.
- Visual parity is checked with screenshots of the key pages: home, games, game detail, tags index, tag page and blog post. Before and after are compared at desktop and mobile widths.

### Tests

- Vitest config:
  - lives in `vite.config.ts` or `vitest.config.ts`, without the Nitro and workflow plugins
  - `~/` alias
  - `node` environment by default
  - `jsdom` for the files that render React
- Existing tests are ported with only mechanical changes: `jest.fn` → `vi.fn`, `jest.mock` → `vi.mock`, `@testing-library/jest-dom/vitest`. The test count must not drop below 91.
- mongodb-memory-server gives a real MongoDB for integration tests. New integration tests, each starting from an empty in-memory database:
  - `getCollection` creates the expected indexes, and keeps going when one conflicts.
  - The scrape route's bulk upsert writes and updates game documents. Steam fetches are stubbed.
  - The compute-stats route produces tag statistics from seeded games.
  - The game page loader returns a game found via esix `Game.findBy`.
- CI (`.github/workflows/pr.yml`) runs on `actions/checkout@v4`, `pnpm/action-setup` and `actions/setup-node@v4` with Node 22 and the pnpm cache. Steps: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`.

## Stage order

Each stage is one commit, or a small group of commits, on the branch `react-router-7-migration`:

1. Parity baseline. Add `scripts/parity.ts` and `docker-compose.yml`, seed the local database, and capture a baseline from the current Remix build.
2. pnpm + Vitest. Switch package manager and test runner, still on Remix 1.19.
3. Remix 1.19 → Remix 2 (Vite compiler).
4. Remix 2 → React Router 7, using the official codemod plus manual fixes, then Nitro + Workflow SDK wiring and the health workflow.
5. MongoDB driver 6 + esix 5.7, mongodb-memory-server integration tests, and the `ensureIndexes` fix.
6. Tailwind 4.
7. Cleanup: drop leftover dependencies, update CI and the README.

## Verification

- **Parity script** (`scripts/parity.ts`, run with `tsx`):
  - Takes a base URL and an output directory.
  - Fetches a fixed route list:
    - `/`, `/games`, `/about`, `/privacy`, `/cookies`
    - `/blog`, the blog post, `/tags`
    - one known tag page and one known game page from the seeded data
    - `/robots.txt`, `/ads.txt`, `/sitemap.xml`, `/sitemap-tags.xml`
    - an unknown path (404)
    - `/api/scrape-games` and `/api/compute-stats` without a key (401)
  - For each route it records: status, `content-type`, `cache-control`, `<title>`, meta tags, canonical link, and a normalised body. Normalising strips asset hashes, script/link tags pointing at build assets, and React Router / Remix hydration data.
  - A `--compare <dir>` mode diffs two captures and exits non-zero on any difference.
  - Output goes to the git-ignored `.parity/`.
- **When the script runs:**
  - Stage 1 captures the baseline.
  - After stages 3–7, compare against the baseline. Every difference is either fixed or explained in the commit message. Expected differences are limited to the error page (stage 4 adds a root `ErrorBoundary`) and the bot or client script tags.
- **On the Vercel preview:**
  - Run the parity script read-only against preview and production. Only GET requests to public pages and the 401 checks.
  - Start the health workflow and confirm it completes in the Vercel Workflows dashboard.
  - Click through the site to check client navigation and hydration.

## Rollout

1. Before the first preview deploy, enable System Environment Variables access in Vercel project settings.
2. Push the branch, open the PR, and verify the preview as described above.
3. Merge to deploy to production.
4. Rollback: promote the previous production deployment in Vercel. No data or schema changes are involved.

## Risks

- **Vercel and Nitro build output.** The Nitro Vercel preset may route or cache differently from `@remix-run/vercel`. The parity comparison against the preview catches header differences.
- **esix 5 on ESM.** The package ships both ESM and CJS and needs `reflect-metadata`. If decorators or metadata cause problems under Vite SSR, add `esix` to `ssr.noExternal` or the opposite, `optimizeDeps`. Decide this during stage 5.
- **Tailwind 4 visual drift.** Default border colour, ring width and preflight differences can shift styles. Screenshot comparison in stage 6 catches this.
- **Production `gameId_1` index.** It is non-unique. That is unchanged by this work, and the existing best-effort index creation keeps tolerating it.
