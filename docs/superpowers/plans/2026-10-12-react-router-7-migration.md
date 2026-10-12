# React Router 7 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the site from Remix 1.19 to React Router 7 on Vite and Nitro, with the Workflow SDK wired in, without changing any page, URL, SEO tag or cache header.

**Architecture:** Upgrade the existing code in place along the official path:

1. pnpm and Vitest
2. Remix 2 on Vite
3. React Router 7
4. Nitro and the Workflow SDK
5. MongoDB driver 6 and esix 5.7
6. Tailwind 4

Before any of that, a parity script captures every public route from the current build, served against a seeded local MongoDB. After each stage the script compares the new build against that capture.

**Tech Stack:**

- Framework: React Router `^7.18`, Vite `^7`, Nitro v3, `workflow` `^5`, React 18
- Data: MongoDB driver `^6.21`, esix `^5.7`
- Testing: Vitest `^5`, mongodb-memory-server `^11`
- Styling and content: Tailwind `^4` via `@tailwindcss/vite`, `@mdx-js/rollup` `^3`
- Tooling: pnpm `10.33.0`, tsx

**Spec:** `docs/superpowers/specs/2026-10-12-react-router-7-migration-design.md`

## Global Constraints

- **Production database.** `.env` points at the PRODUCTION MongoDB.
  - Never start a server, script or test that could read `.env`'s `DB_URL`.
  - Every server or script run in this plan sets `DB_URL=mongodb://127.0.0.1:27017/` and `DB_DATABASE=src-parity` explicitly in the command's environment. Explicit env vars win over `.env` loaders.
  - Never `cat`, print or commit `.env`.
- **Secrets.** Never print, log or commit `STEAM_API_KEY` or `SCRAPE_KEY` values. No task needs `STEAM_API_KEY`.
- **Code style.** No semicolons, single quotes, 2-space indent. Match the surrounding code.
- **Commits.** Messages must not mention Claude and must have no `Co-Authored-By` lines. Use conventional prefixes (`chore:`, `feat:`, `fix:`, `test:`, `docs:`).
- **Branch.** All work is on `react-router-7-migration`. Do not push, open a PR or deploy until the final task says so.
- **Gates.** From Task 2 on, every task ends with `pnpm typecheck`, `pnpm build` and `pnpm test` passing.
  - The test count never drops below the baseline recorded in Task 2. That is 91 or more.
  - From Task 3 on, `pnpm parity:compare` reports no differences except the ones listed as allowed in that task.
- **Versions.** Node engines `>=22`. React stays at 18. Use React Router 7 (`^7.18`), not 8. Use MongoDB driver `^6.21`, not 7, because esix 5.7 peer-requires `mongodb ^6`.
- **Cache headers.** Every route's `headers` export and its Cache-Control value stay byte-identical.

## Review Focus

These are the failures most likely to slip past the tests:

1. **Wrong database.** A dev or prod server started without explicit local env vars, so `.env` silently connects to production. Every run command in this plan sets the env inline, and the seed script refuses non-local URLs (Task 1).
2. **Cache-Control and content-type drift** on resource routes (`robots.txt`, `ads.txt`, `sitemap.xml`, `sitemap-tags.xml`) after moving from Remix `headers` to React Router. The parity script records both headers for every route (Task 1), and every later task compares them.
3. **Hydration breaks while SSR HTML looks right.** Example: CSS links missing or loaded twice, or a client entry error. Task 5 adds a browser check that the home calculator still updates when typing.
4. **Index creation on a fresh database.** A cold start against an empty database must create indexes and serve pages, and a failed index creation must be retried. Task 6 covers this with an integration test.
5. **Tailwind 4 changing visuals** with no change to the HTML structure, through preflight, border colour or ring defaults. Task 7 adds screenshot comparisons.

---

### Task 1: Local MongoDB, seed data and parity baseline

**Files:**
- Create: `docker-compose.yml`
- Create: `scripts/seed-local.ts`
- Create: `scripts/parity.ts`
- Modify: `.gitignore` (add `.parity/`)
- Modify: `package.json` (add `tsx` devDependency and the `seed:local`, `parity:capture` and `parity:compare` scripts)

**Interfaces:**
- Produces:
  - `pnpm seed:local` (`yarn seed:local` in this task) wipes and seeds database `src-parity` on localhost. It exits non-zero if `DB_URL` is not local.
  - `parity:capture <baseUrl> <name>` writes `.parity/<name>/*.json`.
  - `parity:compare <nameA> <nameB>` exits 1 on any difference.
  - Seeded fixtures used by later tasks:
    - game page `/app/367520/hollow-knight`
    - tag page `/tags/action`

- [ ] **Step 1: Start Docker and add the compose file**

Run `docker ps`. If it fails with a pipe error, start Docker Desktop (`"/c/Program Files/Docker/Docker/Docker Desktop.exe" &`) and retry every 10s, for up to 3 minutes. If Docker never comes up, stop and report BLOCKED.

`docker-compose.yml`:

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - '27017:27017'
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

Run `docker compose up -d mongo`. Expected: the container starts and `docker compose ps` shows `mongo` running.

- [ ] **Step 2: Add tsx and the scripts entries**

Run `yarn add -D tsx@^4`.

In `package.json` `scripts`, add:

```json
"seed:local": "tsx scripts/seed-local.ts",
"parity:capture": "tsx scripts/parity.ts capture",
"parity:compare": "tsx scripts/parity.ts compare"
```

Add `.parity/` on its own line in `.gitignore`.

- [ ] **Step 3: Write `scripts/seed-local.ts`**

The seed is deterministic, so two runs produce identical pages. It uses the app's own code to build documents and stats, with a fixed timestamp.

```ts
import { getCollection } from '~/db'
import { computeAllTagStats } from '~/market/compute-all'
import { loadMarketGames } from '~/market/market-service.server'
import { createTagSlugs } from '~/market/tag-slugs'
import { calculateRevenue } from '~/revenue'
import { buildGameUpsert } from '~/steam/build-game-upsert'
import type { ScrapedGame } from '~/steam/map-store-item'

const url = process.env.DB_URL ?? ''
const databaseName = process.env.DB_DATABASE ?? ''

if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  console.error('Refusing to seed: DB_URL must point at a local MongoDB.')
  process.exit(1)
}

if (!databaseName) {
  console.error('Refusing to seed: DB_DATABASE must be set.')
  process.exit(1)
}

const now = Date.UTC(2026, 0, 1)

const tags = createTagSlugs([
  { tagid: 19, name: 'Action' },
  { tagid: 492, name: 'Indie' },
  { tagid: 1664, name: 'Puzzle' },
  { tagid: 597, name: 'Casual' }
])

// The first six are on the home page's popular list.
const names: [number, string][] = [
  [367520, 'Hollow Knight'],
  [1817230, 'Hi-Fi RUSH'],
  [1145360, 'Hades'],
  [973230, 'Raft'],
  [391540, 'Undertale'],
  [207610, 'The Walking Dead']
]

for (let index = 0; names.length < 40; index++) {
  names.push([900000 + index, `Seed Game ${index + 1}`])
}

const games: ScrapedGame[] = names.map(([gameId, name], index) => {
  const reviewCount = 50 + index * 137
  const basePrice = 499 + (index % 5) * 500
  const tagIds =
    index % 3 === 0 ? [19, 492] : index % 3 === 1 ? [492, 1664] : [19, 597]
  const releaseDate = new Date(Date.UTC(2018 + (index % 7), index % 12, 1))

  return {
    gameId,
    name,
    description: `${name} is a seeded game used for local parity checks.`,
    developers: [`Studio ${(index % 4) + 1}`],
    publishers: [`Publisher ${(index % 3) + 1}`],
    screenshots: [],
    tagIds,
    releaseDate,
    releaseYear: releaseDate.getUTCFullYear(),
    reviewCount,
    percentPositive: 70 + (index % 30),
    price: basePrice,
    basePrice,
    grossRevenue: calculateRevenue(reviewCount, basePrice / 100)
  }
})

async function main(): Promise<void> {
  const gamesCollection = await getCollection('games')
  const tagsCollection = await getCollection('tags')
  const marketStats = await getCollection('marketStats')

  await gamesCollection.deleteMany({})
  await tagsCollection.deleteMany({})
  await marketStats.deleteMany({})

  await gamesCollection.bulkWrite(
    games.map((game) =>
      buildGameUpsert(game, now, `seed-${game.gameId}`)
    ),
    { ordered: false }
  )

  await tagsCollection.insertMany(
    tags.map(({ tagId, name, slug }) => ({ tagId, name, slug, gameCount: 0 }))
  )

  const marketGames = await loadMarketGames({ 'tagIds.0': { $exists: true } })
  const { baseline, tags: results } = computeAllTagStats(marketGames)
  const updatedAt = new Date(now)

  await marketStats.updateOne(
    { _id: 'all' },
    { $set: { ...baseline, updatedAt } },
    { upsert: true }
  )

  for (const result of results) {
    await tagsCollection.updateOne(
      { tagId: result.tagId },
      {
        $set: result.stats
          ? {
              gameCount: result.gameCount,
              stats: result.stats,
              statsUpdatedAt: updatedAt
            }
          : { gameCount: result.gameCount }
      }
    )
  }

  console.log(`Seeded ${games.length} games and ${tags.length} tags.`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

If `tsx` cannot resolve `~/` imports, add `--tsconfig tsconfig.json` to the script. tsx reads `paths` from it.

- [ ] **Step 4: Run the seed**

Run:

```bash
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity yarn seed:local
```

Expected: `Seeded 40 games and 4 tags.`

Then check the refusal path:

```bash
DB_URL=mongodb://example.com:27017/ DB_DATABASE=x yarn seed:local
```

Expected: exit 1 with "Refusing to seed".

- [ ] **Step 5: Write `scripts/parity.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'

const routes = [
  '/',
  '/games',
  '/about',
  '/privacy',
  '/cookies',
  '/blog',
  '/blog/the-real-talk-on-steams-cut-what-your-game-actually-makes-and-why-its-complicated',
  '/tags',
  '/tags/action',
  '/app/367520/hollow-knight',
  '/robots.txt',
  '/ads.txt',
  '/sitemap.xml',
  '/sitemap-tags.xml',
  '/does-not-exist',
  '/api/scrape-games',
  '/api/compute-stats',
  '/api/migrate-games'
]

interface Capture {
  route: string
  status: number
  contentType: string
  cacheControl: string
  title: string
  metas: string[]
  canonical: string
  body: string[]
}

const root = path.resolve('.parity')

function fileName(route: string): string {
  return (route.replace(/[^a-z0-9]+/gi, '_') || 'root') + '.json'
}

export function normaliseHtml(html: string): string[] {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*\bsrc="\/(build|assets)\/[^"]*"[^>]*><\/script>/g, '')
    .replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(
      /<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?(__remix|__reactRouter|LiveReload)[\s\S]*?<\/script>/g,
      ''
    )
    .replace(/<link\b[^>]*rel="modulepreload"[^>]*\/?>/g, '')
    .replace(/(href|src)="\/(build|assets)\/[^"]*"/g, '$1="ASSET"')
    .replace(/>\s+</g, '><')
    .replace(/></g, '>\n<')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function extract(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((match) => match[0])
}

async function capture(baseUrl: string, name: string): Promise<void> {
  const directory = path.join(root, name)

  fs.rmSync(directory, { recursive: true, force: true })
  fs.mkdirSync(directory, { recursive: true })

  for (const route of routes) {
    const response = await fetch(new URL(route, baseUrl), {
      redirect: 'manual'
    })
    const text = await response.text()
    const contentType = response.headers.get('content-type') ?? ''
    const isHtml = contentType.includes('text/html')

    const result: Capture = {
      route,
      status: response.status,
      contentType,
      cacheControl: response.headers.get('cache-control') ?? '',
      title: isHtml ? (/<title>([\s\S]*?)<\/title>/.exec(text)?.[1] ?? '') : '',
      metas: isHtml ? extract(text, /<meta\b[^>]*>/g) : [],
      canonical: isHtml
        ? (/<link\b[^>]*rel="canonical"[^>]*>/.exec(text)?.[0] ?? '')
        : '',
      body: isHtml ? normaliseHtml(text) : text.split('\n')
    }

    fs.writeFileSync(
      path.join(directory, fileName(route)),
      JSON.stringify(result, null, 2)
    )
    console.log(`${result.status} ${route}`)
  }
}

function compare(nameA: string, nameB: string): void {
  let differences = 0

  for (const route of routes) {
    const read = (name: string): Capture =>
      JSON.parse(
        fs.readFileSync(path.join(root, name, fileName(route)), 'utf8')
      )
    const a = read(nameA)
    const b = read(nameB)

    for (const field of [
      'status',
      'contentType',
      'cacheControl',
      'title',
      'canonical'
    ] as const) {
      if (a[field] !== b[field]) {
        differences++
        console.log(`${route} ${field}: ${a[field]} -> ${b[field]}`)
      }
    }

    for (const field of ['metas', 'body'] as const) {
      const length = Math.max(a[field].length, b[field].length)
      let shown = 0

      for (let index = 0; index < length && shown < 10; index++) {
        if (a[field][index] !== b[field][index]) {
          differences++
          shown++
          console.log(`${route} ${field}[${index}]:`)
          console.log(`  - ${a[field][index] ?? '<missing>'}`)
          console.log(`  + ${b[field][index] ?? '<missing>'}`)
        }
      }
    }
  }

  console.log(differences === 0 ? 'No differences.' : `${differences} differences.`)
  process.exit(differences === 0 ? 0 : 1)
}

const [command, first, second] = process.argv.slice(2)

if (command === 'capture' && first && second) {
  capture(first, second).catch((error) => {
    console.error(error)
    process.exit(1)
  })
} else if (command === 'compare' && first && second) {
  compare(first, second)
} else {
  console.error(
    'Usage: parity.ts capture <baseUrl> <name> | compare <nameA> <nameB>'
  )
  process.exit(1)
}
```

- [ ] **Step 6: Build and serve the current Remix app locally, then capture the baseline**

The default build targets Vercel (`server.ts`). Building with `NODE_ENV=development` gives a plain server build that `remix-serve` can run. `remix-serve` does not load `.env`.

Run:

```bash
NODE_ENV=development npx remix build
```

Then start the server as a background command:

```bash
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity PORT=3000 npx remix-serve api/index.js
```

Wait until `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/about` prints `200`. Then run:

```bash
yarn parity:capture http://localhost:3000 baseline
```

Expected statuses:

- `200` for every page and resource route
- `200` for `/tags/action`
- `404` for `/does-not-exist`
- `401` for the three `/api/*` routes

If `/tags/action` is a 404, the seed's Action tag has fewer than 10 games. Fix the seed's tag spread rather than the route.

Run the capture a second time as `baseline2`, then `yarn parity:compare baseline baseline2`. Expected: `No differences.` This proves the capture is deterministic. If it isn't, extend `normaliseHtml` until it is, and record what you changed in the report.

Stop the server and delete the `api/` build output (`rm -rf api public/build`).

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml scripts/seed-local.ts scripts/parity.ts .gitignore package.json yarn.lock
git commit -m "chore: add local mongo, seed script and parity checker"
```

---

### Task 2: pnpm and Vitest (still on Remix 1.19)

**Files:**
- Delete: `yarn.lock`, `jest.config.js`
- Create: `pnpm-lock.yaml` (generated), `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json`, `.github/workflows/pr.yml`, every `*.spec.ts` / `*.spec.tsx` under `app/`

**Interfaces:**
- Produces:
  - `pnpm test` runs Vitest once.
  - Tests use `vi`.
  - DOM tests declare `// @vitest-environment jsdom` on line 1.
  - Route component tests mock loader data with `vi.mock('@remix-run/react', ...)`. Task 4 switches the module name to `react-router`.

- [ ] **Step 1: Record the Jest baseline count**

Run `yarn test 2>&1 | tail -8` and write the "Tests: N passed" count into your report. That count is the floor for every later task.

- [ ] **Step 2: Switch to pnpm with the same resolved versions**

```bash
pnpm import
rm yarn.lock
rm -rf node_modules
pnpm install
```

In `package.json`, add `"packageManager": "pnpm@10.33.0"` and change `engines.node` to `">=22.0.0"`.

If the Remix 1.19 build later fails to resolve a transitive dependency under pnpm's strict layout, add an `.npmrc` with `public-hoist-pattern[]=<pattern>` for that package only. Do not switch to `node-linker=hoisted`.

Run `pnpm build`. Expected: the build succeeds.

- [ ] **Step 3: Replace Jest with Vitest**

```bash
pnpm remove jest ts-jest jest-environment-jsdom @types/jest
pnpm add -D vitest@^5 vite@^6.4 jsdom @testing-library/jest-dom@latest
```

Pin `vite` to `^6.4`, because Task 3's `@remix-run/dev` 2.17 needs vite 5 or 6.

`vitest.config.ts`:

```ts
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '~': path.resolve(__dirname, 'app') }
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['app/**/*.spec.{ts,tsx}']
  }
})
```

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

In `package.json`, set `"test": "vitest run"` and `"test:watch": "vitest"`. Delete `jest.config.js`.

In `tsconfig.json`, add `"types": ["vitest/globals"]` only if tests use globals. Prefer explicit imports instead: add `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'` (only the names each file uses) to the top of each spec file.

- [ ] **Step 4: Port the spec files mechanically**

For every spec file under `app/`:

- Replace the `/** @jest-environment jsdom */` docblock with `// @vitest-environment jsdom` on line 1.
- Remove `import '@testing-library/jest-dom'`; the setup file provides it.
- Make these replacements:
  - `jest.fn` → `vi.fn`
  - `jest.spyOn` → `vi.spyOn`
  - `jest.mock` → `vi.mock`
  - `jest.restoreAllMocks` → `vi.restoreAllMocks`
  - `jest.SpyInstance` → `MockInstance`, imported as a type from `vitest`
  - `jest.Mock` → `Mock`, imported as a type from `vitest`
- `app/db/index.spec.ts`: `vi.mock` factories are hoisted above declarations. Move `createIndex` and `dropIndex` into `vi.hoisted`:

```ts
const { createIndex, dropIndex } = vi.hoisted(() => ({
  createIndex: vi.fn(),
  dropIndex: vi.fn()
}))
```

- Route component tests (`game-page`, `home-page`, `tag-page`, `tags-index`) cannot `spyOn` an ESM namespace. Replace `import * as remix from '@remix-run/react'` and `jest.spyOn(remix, 'useLoaderData')` with a module mock:

```tsx
import { useLoaderData } from '@remix-run/react'

vi.mock('@remix-run/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@remix-run/react')>()),
  useLoaderData: vi.fn()
}))
```

  Then, inside each test, call `vi.mocked(useLoaderData).mockReturnValue({ ... })` with the same data the test used before. Keep every assertion unchanged.

Run `pnpm test`. Expected: every test passes, and the count equals Step 1's count.

- [ ] **Step 5: Update CI for pnpm**

`.github/workflows/pr.yml`:

```yaml
name: CI

on: [push]

jobs:
  Test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm test
        env:
          CI: true
```

Run `pnpm typecheck`. If it was already failing on main for reasons unrelated to this task, record the errors in the report and fix them only if the fix is a type-only change.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: switch to pnpm and vitest"
```

Before committing, check `git status` to confirm that `.env` and `.parity/` are not staged.

---

### Task 3: Remix 2 on the Vite compiler

**Files:**
- Create: `vite.config.ts`
- Delete: `remix.config.js`, `server.ts`, `remix.env.d.ts`, `app/globals.css` (only if nothing imports it; check with grep first)
- Modify: `package.json`, `tsconfig.json`, `app/root.tsx`, `app/entry.server.tsx`, `app/entry.client.tsx`, every route under `app/routes/`, `app/components/page.tsx`, `.gitignore`

**Interfaces:**
- Consumes: Task 2's Vitest setup. Keep `vitest.config.ts` separate from `vite.config.ts`, so the Remix plugin never loads in tests.
- Produces:
  - `pnpm build` runs `remix vite:build` and writes `build/server/index.js` and `build/client`.
  - `pnpm start` runs `remix-serve ./build/server/index.js`.

This stage only needs to run locally. The branch is not deployed until Task 9.

- [ ] **Step 1: Upgrade packages**

```bash
pnpm add @remix-run/node@^2.17 @remix-run/react@^2.17 @remix-run/serve@^2.17 isbot@^5
pnpm add -D @remix-run/dev@^2.17 vite-tsconfig-paths@^5 @mdx-js/rollup@^3
pnpm remove @remix-run/css-bundle @remix-run/vercel @vercel/node source-map-support @types/source-map-support @remix-run/eslint-config
```

`@remix-run/eslint-config` is removed because lint is not run in CI and the config is Remix-1-specific. If `.eslintrc*` references it, delete that file too and note it in the report.

- [ ] **Step 2: Vite config**

`vite.config.ts`:

```ts
import mdx from '@mdx-js/rollup'
import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    mdx(),
    remix({
      ignoredRouteFiles: ['**/.*'],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
        v3_singleFetch: true
      }
    }),
    tsconfigPaths()
  ]
})
```

`package.json` scripts:

```json
"build": "remix vite:build",
"dev": "remix vite:dev",
"start": "remix-serve ./build/server/index.js",
"typecheck": "tsc"
```

In `tsconfig.json`:

- set `"include": ["**/*.ts", "**/*.tsx"]`
- set `"types": ["@remix-run/node", "vite/client"]`
- set `"moduleResolution": "Bundler"`
- delete the "Remix takes care of building" comment

Delete `remix.config.js`, `server.ts` and `remix.env.d.ts`.

In `.gitignore`, replace the `/api/index.js`, `/api/index.js.map` and `/api/metafile.*` lines with nothing; `/build` and `/public/build` already exist.

- [ ] **Step 3: Root and entries**

`app/root.tsx`:

- Remove the `cssBundleHref` import and its spread line.
- Change the three CSS imports to `?url` form, keeping the same order in `links`:

```ts
import tailwind from './tailwind.css?url'
import styles from './global.css?url'
import blogStyles from './blog.css?url'
```

- Remove `LiveReload` from the import and the JSX.
- `V2_MetaFunction` → `MetaFunction`.

`app/entry.client.tsx` keeps `RemixBrowser`; it is unchanged except for formatting to the repo's style: no semicolons, single quotes.

`app/entry.server.tsx`:

- Use `import { isbot } from 'isbot'`.
- Change `isbot(request.headers.get('user-agent'))` to `isbot(request.headers.get('user-agent') ?? '')`.
- Import `createReadableStreamFromReadable` from `@remix-run/node`. In both handlers, return:

```ts
new Response(createReadableStreamFromReadable(body), {
  headers: responseHeaders,
  status: responseStatusCode
})
```

  Then call `pipe(body)`.
- Remove the `Response` import from `@remix-run/node`; use the global `Response`.
- Keep `ABORT_DELAY = 5_000`, the bot/browser split, and `responseHeaders.set('Content-Type', 'text/html')`.
- Reformat to the repo's style.

- [ ] **Step 4: Route imports**

Across `app/routes/*` and `app/components/page.tsx`:

- `V2_MetaFunction` → `MetaFunction` (from `@remix-run/node`).
- `json(...)` in `api.compute-stats.ts` and `api.migrate-games.ts` → `Response.json(...)`, with the same body.
- Leave every `headers` export untouched.

The MDX route keeps its filename. `@mdx-js/rollup` compiles it to a default-export component.

- [ ] **Step 5: Build, test, parity**

```bash
pnpm typecheck && pnpm build && pnpm test
```

Expected: all three pass.

Start the server in the background:

```bash
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity PORT=3000 pnpm start
```

Then run:

```bash
pnpm parity:capture http://localhost:3000 stage3
pnpm parity:compare baseline stage3
```

Expected: `No differences.`

If differences remain, fix them in the app so the output matches the baseline. The one exception is a difference caused purely by build tooling (for example, an extra `<link rel="stylesheet">` order change); for those, extend `normaliseHtml` and give the reason in the commit message.

Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: upgrade to remix 2 on vite"
```

---

### Task 4: Remix 2 → React Router 7

**Files:**
- Create: `react-router.config.ts`, `app/routes.ts`
- Modify: `package.json`, `vite.config.ts`, `tsconfig.json`, `.gitignore`, `app/root.tsx`, `app/entry.server.tsx`, `app/entry.client.tsx`, every file importing `@remix-run/*` (routes, `app/components/page.tsx`, route spec files)

**Interfaces:**
- Consumes: Task 3's Remix 2 Vite app.
- Produces:
  - All app code imports from `react-router`.
  - `app/routes.ts` exports `flatRoutes()`.
  - Root exports `Layout`, the default `App` and `ErrorBoundary`.
  - `pnpm start` runs `react-router-serve ./build/server/index.js`; Task 5 replaces it.

- [ ] **Step 1: Run the official codemod, then upgrade packages**

```bash
npx codemod remix/2/react-router/upgrade
```

Then make sure the dependencies are exactly:

```bash
pnpm remove @remix-run/node @remix-run/react @remix-run/serve @remix-run/dev
pnpm add react-router@^7.18 @react-router/node@^7.18 @react-router/serve@^7.18
pnpm add -D @react-router/dev@^7.18 @react-router/fs-routes@^7.18 vite@^7
```

Delete the `react-router-dom` dependency if present. Route tests that import `MemoryRouter` from `react-router-dom` switch to `react-router`.

- [ ] **Step 2: Config files**

`react-router.config.ts`:

```ts
import type { Config } from '@react-router/dev/config'

export default {
  ssr: true,
  buildDirectory: 'build'
} satisfies Config
```

`app/routes.ts`:

```ts
import type { RouteConfig } from '@react-router/dev/routes'
import { flatRoutes } from '@react-router/fs-routes'

export default flatRoutes() satisfies RouteConfig
```

`vite.config.ts`: replace the Remix plugin with `reactRouter()` from `@react-router/dev/vite`. Keep `mdx()` first and `tsconfigPaths()` last.

`package.json` scripts:

```json
"build": "react-router build",
"dev": "react-router dev",
"start": "react-router-serve ./build/server/index.js",
"typecheck": "react-router typegen && tsc"
```

`tsconfig.json`:

- add `".react-router/types/**/*"` to `include`
- add `"rootDirs": [".", "./.react-router/types"]`
- set `types` to `["@react-router/node", "vite/client"]`

`.gitignore`: add `/.react-router`.

- [ ] **Step 3: Verify that flatRoutes picks up every route, including MDX**

Run `npx react-router routes`. Expected: these 18 route files appear, with the same URL paths as before:

- `_index`, `about`, `ads[.]txt`
- `api.compute-stats`, `api.migrate-games`, `api.scrape-games`
- `app.$id.$slug`
- `blog`, `blog._index`, and the blog `.mdx` post
- `cookies`, `games`, `privacy`
- `robots[.]txt`, `sitemap[.]xml`, `sitemap-tags[.]xml`
- `tags.$slug`, `tags._index`

If the `.mdx` route is missing, pass the extension to flatRoutes:

```ts
flatRoutes({ ignoredRouteFiles: ['**/.*'] })
```

If it still doesn't appear, register it explicitly by appending this to the flatRoutes result:

```ts
route(
  'blog/the-real-talk-on-steams-cut-what-your-game-actually-makes-and-why-its-complicated',
  'routes/blog.the-real-talk-on-steams-cut-what-your-game-actually-makes-and-why-its-complicated.mdx'
)
```

  Nest it under the `blog` layout using `[...(await flatRoutes())]` and RouteConfig composition. Note which path you took in the report.

- [ ] **Step 4: Root error boundary and entries**

In `app/root.tsx`, move the `<html>` document into a `Layout({ children })` export that renders `{children}` where `<Outlet />` was. Keep `<Meta />`, `<Links />`, the gtag and adsense scripts, `<ScrollRestoration />` and `<Scripts />`. The default export becomes `export default function App() { return <Outlet /> }`.

Add:

```tsx
export function ErrorBoundary({ error }: { error: unknown }) {
  const status = isRouteErrorResponse(error) ? error.status : 500
  const message =
    status === 404 ? 'This page could not be found.' : 'Something went wrong.'

  return (
    <main className="mx-auto max-w-3xl px-6 py-24 text-paper">
      <h1 className="font-display text-4xl">{status}</h1>
      <p className="mt-4 text-paper-muted">{message}</p>
      <a className="mt-8 inline-block underline" href="/">
        Back to the calculator
      </a>
    </main>
  )
}
```

`isRouteErrorResponse` is imported from `react-router`. Check that `font-display` exists in `tailwind.config.ts`; if not, drop that class.

`app/entry.client.tsx`: replace `RemixBrowser` with `HydratedRouter` from `react-router/dom`.

`app/entry.server.tsx`:

- `RemixServer` → `ServerRouter` from `react-router`
- `EntryContext` from `react-router`
- `createReadableStreamFromReadable` from `@react-router/node`
- remove the `abortDelay` prop and keep `setTimeout(abort, ABORT_DELAY)`

- [ ] **Step 5: Route modules**

For every route:

- Import `Link`, `useLoaderData`, `Outlet` and the types from `react-router`.
- `HeadersFunction`, `MetaFunction` and `LoaderFunction` stay as types imported from `react-router`; that keeps each change small.
- Thrown `new Response(null, { status: 404 })` in loaders stays as it is; React Router 7 still supports it.
- Do not change any `headers` export.

Route spec files change `vi.mock('@remix-run/react', ...)` to `vi.mock('react-router', ...)`, and their `useLoaderData` import to `react-router`.

- [ ] **Step 6: Build, test, parity**

```bash
pnpm typecheck && pnpm build && pnpm test
```

Expected: all three pass.

Start the server in the background:

```bash
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity PORT=3000 pnpm start
```

Then capture and compare:

```bash
pnpm parity:capture http://localhost:3000 stage4
pnpm parity:compare baseline stage4
```

Allowed differences:

- `/does-not-exist` body, title and metas. The new root `ErrorBoundary` replaces Remix's default 404 page. Its status must still be 404.
- Nothing else.

Fix any other difference in app code. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: migrate from remix 2 to react router 7"
```

---

### Task 5: Nitro server and the Workflow SDK

**Files:**
- Create: `server/ssr.ts`, `workflows/health.ts`, `server/routes/api/workflows/health.post.ts`
- Modify: `vite.config.ts`, `react-router.config.ts`, `package.json`, `.gitignore`, `tsconfig.json`

**Interfaces:**
- Consumes: Task 4's React Router app.
- Produces:
  - `pnpm build` (`vite build`) writes `build/server/index.mjs`.
  - `pnpm start` runs `node build/server/index.mjs`.
  - `POST /api/workflows/health` with header `x-scrape-key: <SCRAPE_KEY>` starts the `health` workflow and returns `{ runId }`. Without the key it returns 401.
  - The scraper project adds more workflows under `workflows/`.

Before you start, read https://workflow-sdk.dev/docs/getting-started/react-router (WebFetch). If its config differs from the one below, follow the doc and note the difference in the report.

- [ ] **Step 1: Packages**

```bash
pnpm add nitro@latest workflow@^5
pnpm remove @react-router/serve
```

- [ ] **Step 2: Config**

`react-router.config.ts`:

```ts
import type { Config } from '@react-router/dev/config'

export default {
  ssr: true,
  buildDirectory: 'build',
  future: {
    v8_viteEnvironmentApi: true
  }
} satisfies Config
```

`vite.config.ts`:

```ts
import mdx from '@mdx-js/rollup'
import { reactRouter } from '@react-router/dev/vite'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { workflow } from 'workflow/vite'

export default defineConfig({
  plugins: [
    mdx(),
    reactRouter(),
    nitro({
      serverDir: './server',
      output: {
        dir: 'build',
        serverDir: 'build/server',
        publicDir: 'build/client'
      }
    }),
    workflow({ dirs: ['workflows'] }),
    tsconfigPaths()
  ],
  environments: {
    ssr: {
      build: {
        rollupOptions: { input: './server/ssr.ts' }
      }
    }
  }
})
```

The exact option names for nitro's output and the SSR input must match the workflow-sdk React Router guide. The guide wins over this snippet.

`server/ssr.ts`:

```ts
import { createRequestHandler } from 'react-router'
// @ts-expect-error virtual module provided by the React Router Vite plugin
import * as build from 'virtual:react-router/server-build'

const handler = createRequestHandler(build)

export default {
  fetch: (request: Request) => handler(request)
}
```

`package.json` scripts:

```json
"build": "vite build",
"dev": "vite dev",
"start": "node build/server/index.mjs",
"workflow:web": "workflow web"
```

Keep `typecheck` as it is.

`.gitignore`: add `/.output`, `/.nitro`, `/.workflow-data` and `/.well-known/workflow` (and any other directory the build generates that `git status` shows).

- [ ] **Step 3: Health workflow and its trigger route**

`workflows/health.ts`:

```ts
export async function health(): Promise<{ checkedAt: string }> {
  'use workflow'

  const checkedAt = await recordCheck()

  return { checkedAt }
}

async function recordCheck(): Promise<string> {
  'use step'

  return new Date().toISOString()
}
```

`server/routes/api/workflows/health.post.ts`:

```ts
import { timingSafeEqual } from 'node:crypto'

import { defineHandler } from 'nitro/h3'
import { start } from 'workflow/api'

import { health } from '../../../../workflows/health'

function isAuthorised(provided: string | null): boolean {
  const expected = process.env.SCRAPE_KEY

  if (!expected || !provided) {
    return false
  }

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)

  return a.length === b.length && timingSafeEqual(a, b)
}

export default defineHandler(async (event) => {
  if (!isAuthorised(event.req.headers.get('x-scrape-key'))) {
    return new Response('Unauthorized.', { status: 401 })
  }

  const run = await start(health, [])

  return { runId: run.runId }
})
```

Match the `defineHandler` import path and the request-header access to whatever the guide uses for nitro v3.

- [ ] **Step 4: Build and run locally**

Run `pnpm typecheck && pnpm build && pnpm test`. Expected: all pass.

Start the server in the background:

```bash
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity SCRAPE_KEY=local-test-key PORT=3000 pnpm start
```

Nitro's node server reads `PORT`; if it ignores it, use `NITRO_PORT=3000`.

Check:

- `curl -s -X POST http://localhost:3000/api/workflows/health` → `401`
- `curl -s -X POST -H 'x-scrape-key: local-test-key' http://localhost:3000/api/workflows/health` → JSON with a `runId`
- `pnpm workflow:web` lists the run as completed. Alternatively, check the local world's data directory, then stop the inspector.

- [ ] **Step 5: Parity and hydration check**

Capture and compare:

```bash
pnpm parity:capture http://localhost:3000 stage5
pnpm parity:compare baseline stage5
```

The allowed differences are the same as in Task 4: the 404 page only.

Hydration check: open `http://localhost:3000/` in a browser tool (playwriter or web-developer MCP).

1. Change the Reviews input to `2300` and the Price input to `6.99`.
2. Confirm the `gross-revenue` element shows `$578,772`.
3. Click a link to `/tags` and confirm client-side navigation renders the tags page without a full reload.
4. Check the console for hydration errors; there should be none.

Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: serve through nitro and add the workflow sdk"
```

---

### Task 6: MongoDB driver 6, esix 5.7, and real-database tests

**Files:**
- Modify: `package.json`, `app/db/index.ts`, `app/db/index.spec.ts`, `app/routes/api.scrape-games.ts` (remove `//@ts-ignore`), `vitest.config.ts`
- Create:
  - `vitest.global-setup.ts`
  - `app/tests/integration/db.integration.spec.ts`
  - `app/tests/integration/scrape-games.integration.spec.ts`
  - `app/tests/integration/compute-stats.integration.spec.ts`
  - `app/tests/integration/game-page.integration.spec.ts`

**Interfaces:**
- Consumes: `getCollection(name: string)` from `~/db`; the route loaders `loader({ request, params, context })` from Task 4.
- Produces:
  - `getCollection(name: string): Promise<Collection>` on driver 6, with the same signature.
  - `resetDatabaseConnection(): Promise<void>` is exported for tests only. It closes the client and clears the cached state.
  - Integration tests get a real MongoDB through `inject('mongoUri')`.

- [ ] **Step 1: Upgrade packages**

```bash
pnpm add mongodb@^6.21 esix@^5.7
pnpm remove @types/mongodb mongo-mock
pnpm add -D mongodb-memory-server@^11
```

- [ ] **Step 2: Write the failing retry test**

Add to `app/db/index.spec.ts`:

```ts
it('retries index creation after a failed attempt.', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  dropIndex.mockRejectedValueOnce(new Error('network blip'))
  dropIndex.mockRejectedValue({ code: 27, codeName: 'IndexNotFound' })
  createIndex.mockResolvedValue('ok')

  await expect(getCollection('games')).rejects.toThrow('network blip')
  await getCollection('games')

  expect(createIndex).toHaveBeenCalledTimes(7)
})
```

Add a `beforeEach` that calls `await resetDatabaseConnection()` and `vi.clearAllMocks()`. The existing mock's `MongoClient.connect` must become a constructor-style mock for driver 6 (`new MongoClient(url, options)` followed by `client.connect()`). Update the `vi.mock('mongodb', ...)` factory so `MongoClient` is a class whose `connect()` resolves, and whose `db()` returns `{ collection }`. Also add a `close()` that resolves.

Run `pnpm test app/db/index.spec.ts`. Expected: FAIL. `resetDatabaseConnection` is not exported, and the retry is missing.

- [ ] **Step 3: Rewrite `app/db/index.ts` for driver 6**

```ts
import { MongoClient, type Collection, type Db } from 'mongodb'

let client: MongoClient | undefined
let indexes: Promise<void> | undefined

async function ensureIndexes(db: Db): Promise<void> {
  const games = db.collection('games')
  const tags = db.collection('tags')

  // The name lives at details.name, so this index never did anything.
  try {
    await games.dropIndex('name_1')
  } catch (error: any) {
    const message = String(error?.message ?? '')
    const isMissing =
      error?.code === 27 ||
      error?.codeName === 'IndexNotFound' ||
      message.includes('index not found') ||
      error?.code === 26 ||
      error?.codeName === 'NamespaceNotFound' ||
      message.includes('ns not found')

    if (!isMissing) {
      throw error
    }
  }

  // Best effort: an index that conflicts with an existing one (e.g. a
  // non-unique gameId_1 created before the unique option was added) must
  // not fail the request that happened to trigger this.
  const results = await Promise.allSettled([
    games.createIndex({ grossRevenue: -1 }),
    games.createIndex({ gameId: 1 }, { unique: true }),
    games.createIndex({ tagIds: 1 }),
    games.createIndex({ releaseYear: 1 }),
    games.createIndex({ basePrice: 1 }),
    tags.createIndex({ tagId: 1 }, { unique: true }),
    tags.createIndex({ slug: 1 }, { unique: true })
  ])

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Failed to create index:', result.reason?.message)
    }
  }
}

async function getDatabase(): Promise<Db> {
  const url = process.env.DB_URL ?? 'mongodb://127.0.0.1:27017/'
  const maxPoolSize = parseInt(process.env.DB_POOL_SIZE ?? '10', 10)
  const databaseName = process.env.DB_DATABASE ?? ''

  if (!client) {
    const connecting = new MongoClient(url, { maxPoolSize })

    await connecting.connect()
    client = connecting
  }

  const db = client.db(databaseName)

  // Share one attempt between concurrent callers; forget it on failure so
  // the next request retries.
  indexes ??= ensureIndexes(db).catch((error) => {
    indexes = undefined
    throw error
  })

  await indexes

  return db
}

export async function getCollection(collectionName: string): Promise<Collection> {
  const db = await getDatabase()

  return db.collection(collectionName)
}

export async function resetDatabaseConnection(): Promise<void> {
  const current = client

  client = undefined
  indexes = undefined

  await current?.close()
}
```

`background: true` is dropped because it is ignored since MongoDB 4.2.

Run `pnpm test app/db/index.spec.ts`. Expected: PASS, both tests.

- [ ] **Step 4: Fix driver-6 type errors across the app**

Run `pnpm typecheck`.

- Remove `//@ts-ignore` above `import { ObjectId } from 'mongodb'` in `api.scrape-games.ts`.
- Typical driver-6 errors and their fixes:
  - `_id: 'all'` filters on `Collection<Document>`: fine as they are.
  - `.project(...)` result casts: keep the existing `as` casts.
  - `estimatedDocumentCount()` returns `number`: drop the cast.
- Do not change query semantics.

Esix 5.7 reads `DB_URL` / `DB_DATABASE` just as 3.x did. If Vite SSR fails to load esix (ESM, `reflect-metadata`), add `ssr: { noExternal: [] , external: ['esix'] }` or the inverse to `vite.config.ts`, whichever makes `pnpm build && pnpm start` serve `/app/367520/hollow-knight`. Record which one worked in the report.

- [ ] **Step 5: In-memory MongoDB for integration tests**

`vitest.global-setup.ts`:

```ts
import { MongoMemoryServer } from 'mongodb-memory-server'
import type { TestProject } from 'vitest/node'

let server: MongoMemoryServer | undefined

export async function setup(project: TestProject): Promise<void> {
  server = await MongoMemoryServer.create()
  project.provide('mongoUri', server.getUri())
}

export async function teardown(): Promise<void> {
  await server?.stop()
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string
  }
}
```

In `vitest.config.ts`, add `globalSetup: ['./vitest.global-setup.ts']` and `testTimeout: 30_000`, and add `hookTimeout: 60_000` for the first binary download.

Every integration spec starts with:

```ts
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})
```

- [ ] **Step 6: Integration test for `getCollection` against real MongoDB**

`app/tests/integration/db.integration.spec.ts`, after the header above:

```ts
describe('getCollection (real MongoDB)', () => {
  it('creates the expected indexes on a fresh database.', async () => {
    const games = await getCollection('games')
    const tags = await getCollection('tags')

    const gameIndexes = (await games.indexes()).map(({ name }) => name)
    const tagIndexes = (await tags.indexes()).map(({ name }) => name)

    expect(gameIndexes).toEqual(
      expect.arrayContaining([
        'grossRevenue_-1',
        'gameId_1',
        'tagIds_1',
        'releaseYear_1',
        'basePrice_1'
      ])
    )
    expect(tagIndexes).toEqual(expect.arrayContaining(['tagId_1', 'slug_1']))
  })

  it('still serves when an existing non-unique gameId index conflicts.', async () => {
    await resetDatabaseConnection()
    process.env.DB_DATABASE = `test-${randomUUID()}`

    const { MongoClient } = await import('mongodb')
    const raw = new MongoClient(inject('mongoUri'))

    await raw.connect()
    await raw.db(process.env.DB_DATABASE).collection('games').createIndex({ gameId: 1 })
    await raw.close()

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const games = await getCollection('games')

    await games.insertOne({ gameId: 1 })

    expect(await games.countDocuments()).toBe(1)
    expect(consoleError).toHaveBeenCalledWith('Failed to create index:', expect.any(String))

    consoleError.mockRestore()
  })
})
```

Run `pnpm test app/tests/integration/db.integration.spec.ts`. Expected: PASS. The first run downloads the MongoDB binary.

- [ ] **Step 7: Integration test for the scrape route**

`app/tests/integration/scrape-games.integration.spec.ts`, after the header:

```ts
import { loader } from '~/routes/api.scrape-games'

const storeItem = {
  id: 10,
  appid: 10,
  success: 1,
  name: 'Counter-Strike',
  tags: [{ tagid: 19, weight: 100 }],
  reviews: { summary_filtered: { review_count: 1000, percent_positive: 90 } },
  release: { steam_release_date: 946684800 },
  basic_info: {
    short_description: 'Classic.',
    developers: [{ name: 'Valve' }],
    publishers: [{ name: 'Valve' }]
  },
  best_purchase_option: { final_price_in_cents: '999' }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  })
}

function stubSteam(name: string) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)

    if (url.includes('GetTagList')) {
      return jsonResponse({ response: { tags: [{ tagid: 19, name: 'Action' }] } })
    }

    if (url.includes('GetAppList')) {
      return jsonResponse({
        response: { apps: [{ appid: 10 }], have_more_results: false, last_appid: 10 }
      })
    }

    if (url.includes('GetItems')) {
      return jsonResponse({ response: { store_items: [{ ...storeItem, name }] } })
    }

    throw new Error(`Unexpected fetch: ${url.split('?')[0]}`)
  })
}

function request(cursor = 0): Request {
  return new Request(
    `http://localhost/api/scrape-games?key=test-key&cursor=${cursor}`
  )
}

beforeEach(() => {
  process.env.SCRAPE_KEY = 'test-key'
  process.env.STEAM_API_KEY = 'test-steam-key'
})

describe('scrape-games loader (real MongoDB)', () => {
  it('upserts games and tags, then updates the same document on rescrape.', async () => {
    stubSteam('Counter-Strike')

    const first = (await loader({ request: request(), params: {}, context: {} } as any)) as Response

    expect(await first.json()).toEqual({
      cursor: 0,
      nextCursor: 0,
      fetched: 1,
      saved: 1,
      failed: 0
    })

    vi.restoreAllMocks()
    stubSteam('Counter-Strike Renamed')

    await loader({ request: request(), params: {}, context: {} } as any)

    const games = await getCollection('games')
    const documents = await games.find({ gameId: 10 }).toArray()
    const tags = await (await getCollection('tags')).find({}).toArray()

    expect(documents).toHaveLength(1)
    expect(documents[0].details.name).toBe('Counter-Strike Renamed')
    expect(documents[0].tagIds).toEqual([19])
    expect(tags.map(({ slug }) => slug)).toEqual(['action'])

    vi.restoreAllMocks()
  })

  it('rejects requests without the key.', async () => {
    const response = (await loader({
      request: new Request('http://localhost/api/scrape-games'),
      params: {},
      context: {}
    } as any)) as Response

    expect(response.status).toBe(401)
  })
})
```

If `ignored.json` loading (`data/ignored.json`) fails in the test's working directory, check how `loadIgnoredIds` resolves the path. Do not change the route; run Vitest from the repo root, which is the default.

Run `pnpm test app/tests/integration/scrape-games.integration.spec.ts`. Expected: PASS.

- [ ] **Step 8: Integration tests for compute-stats and the esix game loader**

`app/tests/integration/compute-stats.integration.spec.ts`, after the header:

```ts
import { loader } from '~/routes/api.compute-stats'

describe('compute-stats loader (real MongoDB)', () => {
  it('writes the baseline and stats for tags with enough games.', async () => {
    process.env.SCRAPE_KEY = 'test-key'

    const games = await getCollection('games')
    const tags = await getCollection('tags')

    await tags.insertMany([
      { tagId: 19, name: 'Action', slug: 'action', gameCount: 0 },
      { tagId: 492, name: 'Indie', slug: 'indie', gameCount: 0 }
    ])
    await games.insertMany(
      Array.from({ length: 12 }, (_, index) => ({
        gameId: index + 1,
        slug: `game-${index + 1}`,
        grossRevenue: 1000 * (index + 1),
        basePrice: 999,
        releaseYear: 2020,
        reviewCount: 10 * (index + 1),
        tagIds: index < 3 ? [19, 492] : [19],
        details: { name: `Game ${index + 1}`, developers: [], publishers: [] }
      }))
    )

    const response = (await loader({
      request: new Request('http://localhost/api/compute-stats?key=test-key'),
      params: {},
      context: {}
    } as any)) as Response

    expect(await response.json()).toEqual({ games: 12, tags: 2, tagsWithStats: 1 })

    const action = await tags.findOne({ tagId: 19 })
    const indie = await tags.findOne({ tagId: 492 })
    const baseline = await (await getCollection('marketStats')).findOne({ _id: 'all' as any })

    expect(action?.gameCount).toBe(12)
    expect(action?.stats).toBeDefined()
    expect(indie?.gameCount).toBe(3)
    expect(indie?.stats).toBeUndefined()
    expect(baseline?.stats).toBeDefined()
  })
})
```

`app/tests/integration/game-page.integration.spec.ts`, after the header:

```ts
import { loader } from '~/routes/app.$id.$slug'

describe('game page loader (real MongoDB, esix)', () => {
  it('returns the game details found by esix and its tags.', async () => {
    const games = await getCollection('games')
    const tags = await getCollection('tags')

    await tags.insertOne({ tagId: 19, name: 'Action', slug: 'action', gameCount: 12, stats: {} })
    await games.insertOne({
      _id: 'game-10' as any,
      gameId: 10,
      slug: 'counter-strike',
      grossRevenue: 1000,
      tagIds: [19],
      details: {
        id: 10,
        name: 'Counter-Strike',
        categories: [],
        description: 'Classic.',
        developers: ['Valve'],
        genres: [],
        metacritic: {},
        numberOfReviews: 1000,
        publishers: ['Valve'],
        price: 999,
        screenshots: []
      }
    })

    const result = (await loader({
      request: new Request('http://localhost/app/10/counter-strike'),
      params: { id: '10', slug: 'counter-strike' },
      context: {}
    } as any)) as any

    expect(result.game.name).toBe('Counter-Strike')
    expect(result.tags.map(({ slug }: { slug: string }) => slug)).toEqual(['action'])
  })

  it('throws a 404 response for an unknown game.', async () => {
    await expect(
      loader({
        request: new Request('http://localhost/app/999/nope'),
        params: { id: '999', slug: 'nope' },
        context: {}
      } as any)
    ).rejects.toMatchObject({ status: 404 })
  })
})
```

esix may cache its own connection from the first `DB_URL` / `DB_DATABASE` it sees. These env vars are set in `beforeAll`, before any esix call in this file, so this works. If esix connects at import time instead, set the env in a `vi.hoisted` block at the top of the file.

`getTagIndex` caches for 10 minutes per process. Vitest isolates each file, so this test sees its own data.

Run `pnpm test`. Expected: every test passes, and the count is at least the baseline plus 7.

- [ ] **Step 9: Parity against the seeded local DB**

Run `pnpm build`. Start the server in the background:

```bash
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity PORT=3000 pnpm start
```

Then capture and compare:

```bash
pnpm parity:capture http://localhost:3000 stage6
pnpm parity:compare baseline stage6
```

The only allowed differences are on the 404 page. Stop the server.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: upgrade to mongodb 6 and esix 5 with real-database tests"
```

---

### Task 7: Tailwind 4

**Files:**
- Modify: `package.json`, `vite.config.ts`, `app/tailwind.css`, `tailwind.config.ts` (only if the upgrade tool requires it), any `app/**/*.tsx` whose classes the upgrade tool renames
- Delete: `postcss.config.*` if present and no longer needed

**Interfaces:**
- Consumes: Task 6's app.
- Produces: Tailwind 4 through `@tailwindcss/vite`; the JS theme is kept via `@config`.

- [ ] **Step 1: Capture "before" screenshots**

Run `pnpm build`. Start the server in the background:

```bash
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity PORT=3000 pnpm start
```

Using the browser tool, save full-page screenshots to `.parity/screens/before/` for these pages:

- `/`
- `/games`
- `/app/367520/hollow-knight`
- `/tags`
- `/tags/action`
- the blog post

Take each at 1280×800 and at 390×844. Stop the server.

- [ ] **Step 2: Run the official upgrade tool**

```bash
npx @tailwindcss/upgrade@latest --force
```

Then make sure:

- `pnpm add -D tailwindcss@^4 @tailwindcss/vite@^4`
- `tailwindcss-animate` stays installed. It is loaded by the JS config.
- `app/tailwind.css` contains:

```css
@import 'tailwindcss';
@config '../tailwind.config.ts';
```

The upgrade tool may have added compatibility CSS, such as the default border colour layer. Keep it, because it preserves Tailwind 3's look.

- `vite.config.ts` adds `tailwindcss()` from `@tailwindcss/vite` to `plugins`, right after `mdx()`.

Delete any `postcss.config.*` that only configured tailwind or autoprefixer, and remove `autoprefixer` / `postcss` from devDependencies if nothing else uses them.

Review the tool's class renames with `git diff`. The renames to expect are `shadow-sm` → `shadow-xs`, `rounded` → `rounded-sm`, `outline-none` → `outline-hidden`, and `ring` → `ring-3`. Revert any edit the tool made outside class strings.

- [ ] **Step 3: "After" screenshots and comparison**

Run `pnpm typecheck && pnpm build && pnpm test`. Expected: all pass.

Start the server again and take the same screenshots into `.parity/screens/after/`. Compare each pair visually, using the image reader. Fix any visible difference in spacing, borders, rings, colours, fonts or layout by adjusting CSS or classes until each pair matches. List each fix in the report.

Then capture and compare:

```bash
pnpm parity:capture http://localhost:3000 stage7
pnpm parity:compare baseline stage7
```

Allowed differences:

- the 404 page
- class-name renames made by the upgrade tool (for example `shadow-sm` → `shadow-xs`)

List every allowed difference in the commit message body. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: upgrade to tailwind 4"
```

---

### Task 8: Cleanup, README and final local verification

**Files:**
- Modify: `package.json`, `README.md`, `.gitignore`, `tsconfig.json`
- Delete: unused files left over from Remix (for example `public/build` if it is still tracked, and `api/` if tracked)

**Interfaces:**
- Consumes: everything from earlier tasks.
- Produces: the final dependency set and local development docs.

- [ ] **Step 1: Dependency sweep**

Run each of these:

```bash
grep -rn "@remix-run\|react-router-dom\|mongo-mock\|jest\b\|source-map-support\|@vercel/node" app server workflows scripts package.json
```

Expected: no matches (`jest-dom` matches are fine).

```bash
pnpm why @remix-run/node
```

Expected: not installed.

```bash
pnpm outdated
```

Update only patch/minor versions of packages this plan touched. Do not take new majors; the Global Constraints pin React 18, React Router 7 and MongoDB 6.

`package.json` `keywords`: replace `"remix"` with `"react-router"`.

- [ ] **Step 2: README local development section**

Add this section to `README.md` (create the file if it is missing), with the current scripts:

````markdown
## Local development

Requires Node 22+, pnpm and Docker.

```bash
docker compose up -d mongo
cp .env.template .env.local   # local values only; never point this at production
pnpm install
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity pnpm seed:local
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity pnpm dev
```

`pnpm test` runs unit tests and integration tests against an in-memory MongoDB.
`pnpm parity:capture <url> <name>` and `pnpm parity:compare <a> <b>` compare two builds route by route.
`pnpm workflow:web` opens the local workflow run inspector.
````

- [ ] **Step 3: Full verification**

Run each check:

- `pnpm install --frozen-lockfile && pnpm typecheck && pnpm build && pnpm test`. Expected: all pass, and the test count is at least the baseline plus 7.
- Under Node 22, run `npx -y -p node@22 node build/server/index.mjs` with the local env vars and `PORT=3000`. Then run the final capture and compare:

```bash
pnpm parity:capture http://localhost:3000 final
pnpm parity:compare baseline final
```

  The only differences are the ones allowed in Task 7.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove remix leftovers and document local development"
```

---

### Task 9: Vercel preview and PR

**Files:** none, unless the preview exposes a problem.

This task has outward-facing steps. The controller performs them, not a subagent, and confirms with the user before pushing.

- [ ] **Step 1: Confirm Vercel prerequisites with the user**

Ask the user to:

1. Enable "Automatically expose System Environment Variables" for the project.
2. Set the Framework Preset to "Other" (or leave it on auto-detect if Vercel recognises Nitro's Build Output API).
3. Make sure the build command is `pnpm build` and the install command is `pnpm install`.

Wait for confirmation before going on.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin react-router-7-migration
gh pr create --title "Migrate from Remix 1.19 to React Router 7 with Nitro and the Workflow SDK" --body-file <file>
```

The body summarises each stage, the parity results and the allowed differences. Link the PR with `mcp__t3-code__link_pull_request`.

- [ ] **Step 3: Verify the preview**

Once the preview is ready, run the read-only checks:

```bash
pnpm parity:capture https://<preview-url> preview
pnpm parity:capture https://steam-revenue-calculator.com prod
pnpm parity:compare prod preview
```

Differences in body content are expected, because preview and production share the production database but may render at different times. Status codes, content types, Cache-Control headers, titles and canonical tags must match.

The health workflow needs `SCRAPE_KEY`, so ask the user to run:

```bash
curl -X POST -H "x-scrape-key: $SCRAPE_KEY" https://<preview-url>/api/workflows/health
```

Then confirm with them that the run completes in the Vercel Workflows dashboard.

In a browser: the home calculator updates when typing, and client-side navigation from `/` → `/tags` → a tag page works, with no console errors.

- [ ] **Step 4: Fix and report**

If CI or the preview fails, fix the problem on the branch, push, and recheck.

Report the PR URL and the verification results to the user.
