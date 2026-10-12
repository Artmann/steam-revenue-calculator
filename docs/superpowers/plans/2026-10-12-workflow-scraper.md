# Workflow-based scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual, cursor-driven scrape and stats endpoints with one durable Workflow SDK run. A daily Vercel Cron starts it. The run refreshes the full Steam catalog, flags delisted games, recomputes tag stats, and records a summary in Mongo.

**Architecture:** `workflows/scrape-games.ts` holds the `'use workflow'` orchestration. It only calls steps, a pure `chunk` helper and `workflow` APIs.
- `workflows/scrape-games-steps.ts` holds thin `'use step'` wrappers.
- The wrappers call plain modules in `app/scrape/`. Those modules are tested against mongodb-memory-server, without the workflow runtime.
- A Nitro route authorises cron and manual triggers, then calls `start()`.
- Workflow orchestration tests use `@workflow/vitest`, which runs workflows in-process on the Local World with a fake Steam behind a stubbed `fetch`.

**Tech Stack:**
- React Router 7 and Nitro v3 (beta `3.0.260903-beta`)
- Workflow SDK `workflow` ^5.2 and `@workflow/vitest` ^5
- MongoDB driver 6 and Vitest 5, with mongodb-memory-server
- pnpm 10 and Node >= 22

**Spec:** `docs/superpowers/specs/2026-10-12-workflow-scraper-design.md`

## Global Constraints

**Commands and secrets**
- Run every `pnpm` command from `C:\Users\Artga\Code\steam-revenue-calculator`, with a capital `C` in `Code`. The lowercase path loads two copies of React.
- Never run `pnpm dev`, never read or print `.env`, and never print `STEAM_API_KEY`, `SCRAPE_KEY` or `CRON_SECRET`. `.env` points at the PRODUCTION database.
- Any script or server you start must set `DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity` inline.
- Error messages and logs never include a Steam URL's query string, because it contains the API key.

**Commits**
- Use lower-case conventional messages (`feat: …`, `fix: …`, `chore: …`, `test: …`, `docs: …`).
- No `Co-Authored-By` lines and no Claude attribution.

**Code style**
- No semicolons, single quotes, 2-space indent.
- `app/` code imports through the `~/` alias. Files in `server/` and `workflows/` import other folders with relative paths.
- Test names are full sentences ending with a period, e.g. `it('skips only the failing batch and reports its ids.', …)`.

**Workflow rules**
- `'use workflow'` functions must not import Node modules or do I/O. They may only call steps, pure helpers and `workflow` APIs.
- Every `'use step'` function lives in `workflows/scrape-games-steps.ts`.
- Chunk steps return `void`, which keeps step payloads small.

**Gates:** at the end of every task, `pnpm typecheck`, `pnpm test` and `pnpm build` must pass, in that order. `pnpm test` deletes `build/` before the workflow tests, so `pnpm build` runs last.

**Fixed values (verbatim from the spec):**

| Name | Value |
|---|---|
| Chunk size | 1000 ids |
| `GetItems` batch | 200 ids |
| `GetAppList` page size | 50000 |
| `listedAt` update slices | 10000 |
| Request timeout | 30_000 ms |
| Rate-limit retry wait | 1 minute |
| Delisting guard | listed ≥ 0.9 × active |
| Games per sitemap | 40000 |
| Cron schedule | `0 4 * * *` |
| Hook token | `scrape-games` |

## Review Focus

These conditions are implied by the spec but no other test covers them. Each one is pinned by a test in the task named.
1. **Back-to-back runs.** A finished run must release the `scrape-games` hook, so the next day's run is not skipped. Task 6's rescrape test runs the workflow twice in a row and asserts the second run is not skipped.
2. **Rate limits propagate.** A Steam 429 inside `fetchStoreItems` must reach the step as `RetryableError`. Recording it as failed ids would mean rate-limited batches never wait. Task 3 tests this.
3. **Listed but unsaved games.** A game that is listed but that `mapStoreItem` drops (for example a free game already in the DB) must not be flagged as delisted. Task 6's delisting test covers it.
4. **Paging always ends.** An empty page with `have_more_results: true`, or a page whose `last_appid` doesn't move forward, must stop paging instead of looping. Task 4 tests this.
5. **Bad sitemap pages.** `/sitemap-games/0`, `/sitemap-games/abc`, `/sitemap-games/01` and a page past the end must return 404, not 500. Task 8 tests this.

## Rulings made while planning

- **Retry results get their own map.** Retry-pass results are stored in a `retryChunks` map, alongside the spec's `retry` summary, so a retried retry step stays idempotent. Cost if wrong: one extra field on `scrapeRuns`.
- **`/sitemap-pages.xml` holds only the `/games?page=N` URLs.** The static pages are already in `/sitemap-tags.xml`, and repeating them would duplicate URLs across sitemaps. Cost if wrong: a few static URLs to move later.
- **`pnpm scrape:local` calls the plain `app/scrape` functions in workflow order, not the workflow runtime.** Running the runtime locally needs `pnpm dev`, which loads the production `.env`. The orchestration is covered by the workflow tests instead.
- **The 429 wait is configurable.** The wait reads `STEAM_RATE_LIMIT_RETRY_AFTER_MS` when it is set to a positive number, and defaults to 60000. Workflow tests set it to `10` so retry paths run in milliseconds.
- **The workflow test script deletes `build/`.** The `@workflow/vitest` builder scans the whole project for directives, and its ignore list cannot be configured, so it would pick up `build/`. A planning spike confirmed this.

## File map

| File | Responsibility |
|---|---|
| `vitest.workflows.config.ts` | Vitest config for workflow integration tests (`workflows/**/*.spec.ts`) |
| `app/scrape/run-record.ts` | `scrapeRuns` document type and its reads and writes |
| `app/scrape/chunk.ts` | Pure array chunking |
| `app/scrape/sync-tags.ts` | Fetch Steam tags and upsert them with stable slugs |
| `app/scrape/list-app-ids.ts` | Page through `GetAppList` and mark listed games |
| `app/scrape/scrape-ids.ts` | Fetch, map and upsert one set of app ids |
| `app/scrape/mark-delisted.ts` | Guarded `delistedAt` flagging |
| `app/scrape/trigger-auth.ts` | Constant-time cron and manual authorisation |
| `app/market/compute-and-save-stats.server.ts` | Tag stats computation, moved out of the old route |
| `app/sitemap/xml.ts` | Sitemap XML rendering helpers |
| `workflows/scrape-games.ts` | The `scrapeGames` workflow |
| `workflows/scrape-games-steps.ts` | `'use step'` wrappers |
| `workflows/scrape-games.spec.ts` | Workflow integration tests |
| `server/routes/api/workflows/scrape.ts` | Trigger endpoint (`GET` cron, `POST` manual) |
| `app/routes/sitemap[.]xml.tsx` | Sitemap index |
| `app/routes/sitemap-pages[.]xml.tsx` | `/games?page=N` URLs |
| `app/routes/sitemap-games.$page.tsx` | 40k game URLs per page |
| `scripts/scrape-local.ts` | Opt-in local scrape against Docker Mongo |

---

### Task 1: Workflow test harness, run record and workflow skeleton

**Files:**
- Modify:
  - `package.json`: add the dev dependency and scripts
  - `.gitignore`
  - `app/db/index.ts`: add the `scrapeRuns` index
- Create:
  - `vitest.workflows.config.ts`
  - `app/scrape/run-record.ts`
  - `workflows/scrape-games-steps.ts`
  - `workflows/scrape-games.ts`
- Test:
  - `app/tests/integration/run-record.integration.spec.ts`
  - `workflows/scrape-games.spec.ts`

**Interfaces:**
- Produces, in `~/scrape/run-record`:

  ```ts
  export type ScrapeTrigger = 'cron' | 'manual'
  export type ScrapeRunStatus = 'running' | 'succeeded' | 'failed'
  export type ChunkField = 'chunks' | 'retryChunks'
  export interface ChunkResult { saved: number; failedIds: number[] }
  export type DelistedResult = { count: number } | { skipped: true; listed: number; active: number }
  export interface RetrySummary { attempted: number; saved: number; stillFailed: number[] }
  export interface StatsSummary { games: number; tags: number; tagsWithStats: number }
  export interface ScrapeRunDocument { … }
  startRun(runId: string, trigger: ScrapeTrigger, startedAt: number): Promise<void>
  updateRun(runId: string, fields: Partial<Pick<ScrapeRunDocument, 'listed' | 'retry' | 'delisted' | 'stats'>>): Promise<void>
  recordChunk(runId: string, field: ChunkField, index: number, result: ChunkResult): Promise<void>
  collectFailedIds(runId: string, field: ChunkField): Promise<number[]>
  summariseRetry(runId: string, attempted: number): Promise<RetrySummary>
  finishRun(runId: string, status: 'succeeded' | 'failed', error?: string): Promise<void>
  findRun(runId: string): Promise<ScrapeRunDocument | null>
  ```

- Produces the workflow:

  ```ts
  scrapeGames(input: { trigger: ScrapeTrigger }): Promise<ScrapeGamesResult>
  export type ScrapeGamesResult = { skipped: true; activeRunId: string } | { skipped: false; runId: string }
  ```

- [ ] **Step 1: Install the test plugin and add the scripts**

Run: `pnpm add -D @workflow/vitest@^5`

In `package.json` `scripts`, replace `"test": "vitest run",` with:

```json
    "test": "vitest run && pnpm test:workflows",
    "test:unit": "vitest run",
    "test:workflows": "node -e \"require('node:fs').rmSync('build',{recursive:true,force:true})\" && vitest run -c vitest.workflows.config.ts",
```

Append to `.gitignore`:

```
/.workflow-vitest
.swc
```

- [ ] **Step 2: Create `vitest.workflows.config.ts`**

```ts
import path from 'node:path'
import { workflow } from '@workflow/vitest'
import { defineConfig } from 'vitest/config'

// Runs the compiled workflows in-process on the Local World. The plugin scans
// the whole project for directives and cannot ignore build/, so the
// test:workflows script deletes build/ first.
export default defineConfig({
  plugins: [workflow()],
  resolve: {
    alias: { '~': path.resolve(__dirname, 'app') }
  },
  test: {
    environment: 'node',
    globalSetup: ['./vitest.global-setup.ts'],
    include: ['workflows/**/*.spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000
  }
})
```

- [ ] **Step 3: Write the failing run-record integration test**

`app/tests/integration/run-record.integration.spec.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { resetDatabaseConnection } from '~/db'
import {
  collectFailedIds,
  findRun,
  finishRun,
  recordChunk,
  startRun,
  summariseRetry,
  updateRun
} from '~/scrape/run-record'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

describe('scrape run record (real MongoDB)', () => {
  it('starts a run once, so a retried start never resets it.', async () => {
    await startRun('run-1', 'cron', Date.UTC(2026, 9, 12))
    await finishRun('run-1', 'succeeded')
    await startRun('run-1', 'manual', Date.UTC(2026, 9, 13))

    const run = await findRun('run-1')

    expect(run).toMatchObject({
      trigger: 'cron',
      status: 'succeeded',
      startedAt: new Date(Date.UTC(2026, 9, 12))
    })
    expect(run?.finishedAt).toBeInstanceOf(Date)
  })

  it('overwrites a chunk result when the chunk is recorded again.', async () => {
    await startRun('run-2', 'cron', 1)
    await recordChunk('run-2', 'chunks', 0, { saved: 1, failedIds: [5] })
    await recordChunk('run-2', 'chunks', 0, { saved: 2, failedIds: [] })

    const run = await findRun('run-2')

    expect(run?.chunks).toEqual({ '0': { saved: 2, failedIds: [] } })
  })

  it('collects failed ids across chunks, sorted and without duplicates.', async () => {
    await startRun('run-3', 'cron', 1)
    await recordChunk('run-3', 'chunks', 0, { saved: 0, failedIds: [9, 3] })
    await recordChunk('run-3', 'chunks', 1, { saved: 0, failedIds: [3, 1] })

    expect(await collectFailedIds('run-3', 'chunks')).toEqual([1, 3, 9])
    expect(await collectFailedIds('run-3', 'retryChunks')).toEqual([])
  })

  it('summarises the retry pass from its chunk results.', async () => {
    await startRun('run-4', 'cron', 1)
    await recordChunk('run-4', 'retryChunks', 0, { saved: 3, failedIds: [8] })
    await recordChunk('run-4', 'retryChunks', 1, { saved: 1, failedIds: [] })

    const retry = await summariseRetry('run-4', 5)

    expect(retry).toEqual({ attempted: 5, saved: 4, stillFailed: [8] })
    expect((await findRun('run-4'))?.retry).toEqual(retry)
  })

  it('records updates and a failure message.', async () => {
    await startRun('run-5', 'manual', 1)
    await updateRun('run-5', { listed: 42, delisted: { count: 2 } })
    await finishRun('run-5', 'failed', 'Steam is down.')

    expect(await findRun('run-5')).toMatchObject({
      listed: 42,
      delisted: { count: 2 },
      status: 'failed',
      error: 'Steam is down.'
    })
  })
})
```

Run: `pnpm vitest run app/tests/integration/run-record.integration.spec.ts`
Expected: FAIL, because `~/scrape/run-record` cannot be resolved.

- [ ] **Step 4: Implement `app/scrape/run-record.ts`**

```ts
import type { Collection } from 'mongodb'

import { getCollection } from '~/db'

export type ScrapeTrigger = 'cron' | 'manual'
export type ScrapeRunStatus = 'running' | 'succeeded' | 'failed'
export type ChunkField = 'chunks' | 'retryChunks'

export interface ChunkResult {
  saved: number
  failedIds: number[]
}

export type DelistedResult =
  | { count: number }
  | { skipped: true; listed: number; active: number }

export interface RetrySummary {
  attempted: number
  saved: number
  stillFailed: number[]
}

export interface StatsSummary {
  games: number
  tags: number
  tagsWithStats: number
}

export interface ScrapeRunDocument {
  _id: string
  trigger: ScrapeTrigger
  status: ScrapeRunStatus
  startedAt: Date
  finishedAt?: Date
  listed?: number
  chunks?: Record<string, ChunkResult>
  retryChunks?: Record<string, ChunkResult>
  retry?: RetrySummary
  delisted?: DelistedResult
  stats?: StatsSummary
  error?: string
}

async function scrapeRuns(): Promise<Collection<ScrapeRunDocument>> {
  return (await getCollection(
    'scrapeRuns'
  )) as unknown as Collection<ScrapeRunDocument>
}

export async function findRun(runId: string): Promise<ScrapeRunDocument | null> {
  const collection = await scrapeRuns()

  return collection.findOne({ _id: runId })
}

export async function startRun(
  runId: string,
  trigger: ScrapeTrigger,
  startedAt: number
): Promise<void> {
  const collection = await scrapeRuns()

  // $setOnInsert keeps a retried step from resetting a run that has moved on.
  await collection.updateOne(
    { _id: runId },
    {
      $setOnInsert: {
        trigger,
        status: 'running',
        startedAt: new Date(startedAt)
      }
    },
    { upsert: true }
  )
}

export async function updateRun(
  runId: string,
  fields: Partial<
    Pick<ScrapeRunDocument, 'listed' | 'retry' | 'delisted' | 'stats'>
  >
): Promise<void> {
  const collection = await scrapeRuns()

  await collection.updateOne({ _id: runId }, { $set: fields })
}

export async function recordChunk(
  runId: string,
  field: ChunkField,
  index: number,
  result: ChunkResult
): Promise<void> {
  const collection = await scrapeRuns()

  // Keyed by index, so a retried step overwrites its result instead of adding to it.
  await collection.updateOne(
    { _id: runId },
    { $set: { [`${field}.${index}`]: result } }
  )
}

function chunkResults(
  run: ScrapeRunDocument | null,
  field: ChunkField
): ChunkResult[] {
  return Object.values(run?.[field] ?? {})
}

function uniqueSorted(ids: number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b)
}

export async function collectFailedIds(
  runId: string,
  field: ChunkField
): Promise<number[]> {
  const results = chunkResults(await findRun(runId), field)

  return uniqueSorted(results.flatMap(({ failedIds }) => failedIds))
}

export async function summariseRetry(
  runId: string,
  attempted: number
): Promise<RetrySummary> {
  const results = chunkResults(await findRun(runId), 'retryChunks')

  const retry: RetrySummary = {
    attempted,
    saved: results.reduce((total, { saved }) => total + saved, 0),
    stillFailed: uniqueSorted(results.flatMap(({ failedIds }) => failedIds))
  }

  await updateRun(runId, { retry })

  return retry
}

export async function finishRun(
  runId: string,
  status: 'succeeded' | 'failed',
  error?: string
): Promise<void> {
  const collection = await scrapeRuns()

  await collection.updateOne(
    { _id: runId },
    {
      $set: {
        status,
        finishedAt: new Date(),
        ...(error === undefined ? {} : { error })
      }
    }
  )
}
```

In `app/db/index.ts` `ensureIndexes`:
- Add `const scrapeRuns = db.collection('scrapeRuns')` next to `const tags`.
- Add `scrapeRuns.createIndex({ startedAt: -1 })` to the `Promise.allSettled` list.

Run: `pnpm vitest run app/tests/integration/run-record.integration.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing workflow test**

`workflows/scrape-games.spec.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { start } from 'workflow/api'

import { resetDatabaseConnection } from '~/db'
import { findRun } from '~/scrape/run-record'

import { scrapeGames } from './scrape-games'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

describe('scrapeGames workflow', () => {
  it('records a run that starts and succeeds.', async () => {
    const run = await start(scrapeGames, [{ trigger: 'manual' }])

    expect(await run.returnValue).toEqual({ skipped: false, runId: run.runId })

    const record = await findRun(run.runId)

    expect(record).toMatchObject({ trigger: 'manual', status: 'succeeded' })
    expect(record?.finishedAt).toBeInstanceOf(Date)
  })
})
```

Run: `pnpm test:workflows`
Expected: FAIL, because `./scrape-games` cannot be resolved.

- [ ] **Step 6: Implement the steps file and the workflow skeleton**

`workflows/scrape-games-steps.ts`:

```ts
import {
  finishRun,
  startRun,
  type ScrapeTrigger
} from '~/scrape/run-record'

export async function startRunStep(
  runId: string,
  trigger: ScrapeTrigger,
  startedAt: number
): Promise<void> {
  'use step'

  await startRun(runId, trigger, startedAt)
}

export async function finishRunStep(
  runId: string,
  status: 'succeeded' | 'failed',
  error?: string
): Promise<void> {
  'use step'

  await finishRun(runId, status, error)
}
```

`workflows/scrape-games.ts`:

```ts
import { createHook, getWorkflowMetadata } from 'workflow'

import type { ScrapeTrigger } from '~/scrape/run-record'

import { finishRunStep, startRunStep } from './scrape-games-steps'

export type ScrapeGamesResult =
  | { skipped: true; activeRunId: string }
  | { skipped: false; runId: string }

export async function scrapeGames(input: {
  trigger: ScrapeTrigger
}): Promise<ScrapeGamesResult> {
  'use workflow'

  // A fixed token makes a second run exit before it touches Steam or Mongo.
  // The runtime releases the token when this run ends.
  const hook = createHook({ token: 'scrape-games' })
  const conflict = await hook.getConflict()

  if (conflict) {
    return { skipped: true, activeRunId: conflict.runId }
  }

  const { workflowRunId: runId } = getWorkflowMetadata()
  const runStartedAt = Date.now()

  try {
    await startRunStep(runId, input.trigger, runStartedAt)
    await finishRunStep(runId, 'succeeded')

    return { skipped: false, runId }
  } catch (error) {
    await finishRunStep(
      runId,
      'failed',
      error instanceof Error ? error.message : String(error)
    )

    throw error
  }
}
```

Run: `pnpm test:workflows`
Expected: PASS, 1 test.

If the `getConflict` or `getWorkflowMetadata` names don't type-check, look them up in `node_modules/workflow/docs/api-reference/workflow/create-hook.mdx` and `get-workflow-metadata.mdx`, and adjust to the documented names.

If `fetch` or the Mongo client misbehave inside steps, the cause is that steps run from a bundle with its own copy of `~/db`. That copy reads `DB_URL` and `DB_DATABASE` from `process.env` when it is called, so set them in `beforeAll` before starting any run.

- [ ] **Step 7: Gates, then commit**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all pass. `git status` shows no generated artifacts (`.workflow-vitest`, `.workflow-data`, `.swc`). If the plugin generated `workflows/.gitignore`, commit it.

```bash
git add package.json pnpm-lock.yaml .gitignore vitest.workflows.config.ts app/db/index.ts app/scrape/run-record.ts app/tests/integration/run-record.integration.spec.ts workflows/scrape-games.ts workflows/scrape-games-steps.ts workflows/scrape-games.spec.ts
git commit -m "feat: add the scrape run record and workflow skeleton"
```

---

### Task 2: Remove the old endpoints and extract the stats job

**Files:**
- Create: `app/market/compute-and-save-stats.server.ts`
- Delete:
  - `app/routes/api.scrape-games.ts`
  - `app/routes/api.compute-stats.ts`
  - `app/routes/api.migrate-games.ts`
  - `app/tests/integration/scrape-games.integration.spec.ts`
  - `workflows/health.ts`
  - `server/routes/api/workflows/health.post.ts`
- Modify:
  - `app/services/game-service.server.ts`: remove `migrateGamesToDatabase` and the imports only it used
  - `app/games/index.ts`: remove `fetchGames` and the module-level `games` cache
  - `scripts/parity.ts`: drop the three `/api/...` routes from the list
- Test: `app/tests/integration/compute-stats.integration.spec.ts` (rewrite)

**Interfaces:**
- Consumes `StatsSummary` from `~/scrape/run-record` (Task 1).
- Produces `computeAndSaveStats(): Promise<StatsSummary>` in `~/market/compute-and-save-stats.server`.

- [ ] **Step 1: Rewrite the stats integration test to target the new function**

Replace `app/tests/integration/compute-stats.integration.spec.ts` with:

```ts
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { computeAndSaveStats } from '~/market/compute-and-save-stats.server'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

describe('computeAndSaveStats (real MongoDB)', () => {
  it('writes the baseline and stats for tags with enough games.', async () => {
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

    expect(await computeAndSaveStats()).toEqual({
      games: 12,
      tags: 2,
      tagsWithStats: 1
    })

    const action = await tags.findOne({ tagId: 19 })
    const indie = await tags.findOne({ tagId: 492 })
    const baseline = await (await getCollection('marketStats')).findOne({
      _id: 'all' as any
    })

    expect(action?.gameCount).toBe(12)
    expect(action?.stats).toBeDefined()
    expect(indie?.gameCount).toBe(3)
    expect(indie?.stats).toBeUndefined()
    expect(baseline?.stats).toBeDefined()
  })
})
```

Run: `pnpm vitest run app/tests/integration/compute-stats.integration.spec.ts`
Expected: FAIL, because the module cannot be resolved.

- [ ] **Step 2: Create `app/market/compute-and-save-stats.server.ts`**

```ts
import { getCollection } from '~/db'
import { computeAllTagStats } from '~/market/compute-all'
import { loadMarketGames } from '~/market/market-service.server'
import type { StatsSummary } from '~/scrape/run-record'

export async function computeAndSaveStats(): Promise<StatsSummary> {
  // Only games scraped since tags were introduced carry tagIds.
  const games = await loadMarketGames({ 'tagIds.0': { $exists: true } })
  const { baseline, tags } = computeAllTagStats(games)
  const now = new Date()

  const marketStats = await getCollection('marketStats')

  await marketStats.updateOne(
    { _id: 'all' as any },
    { $set: { ...baseline, updatedAt: now } },
    { upsert: true }
  )

  const results = new Map(tags.map((result) => [result.tagId, result]))
  const tagsCollection = await getCollection('tags')
  const tagIds = (
    (await tagsCollection
      .find({})
      .project({ _id: 0, tagId: 1 })
      .toArray()) as { tagId: number }[]
  ).map(({ tagId }) => tagId)

  const operations = tagIds.map((tagId) => {
    const result = results.get(tagId)

    return result?.stats
      ? {
          updateOne: {
            filter: { tagId },
            update: {
              $set: {
                gameCount: result.gameCount,
                stats: result.stats,
                statsUpdatedAt: now
              }
            }
          }
        }
      : {
          updateOne: {
            filter: { tagId },
            update: {
              $set: { gameCount: result?.gameCount ?? 0 },
              $unset: { stats: '', statsUpdatedAt: '' }
            }
          }
        }
  })

  if (operations.length > 0) {
    await tagsCollection.bulkWrite(operations, { ordered: false })
  }

  return {
    games: games.length,
    tags: tagIds.length,
    tagsWithStats: tags.filter(({ stats }) => stats).length
  }
}
```

Run: `pnpm vitest run app/tests/integration/compute-stats.integration.spec.ts`
Expected: PASS.

- [ ] **Step 3: Delete the old endpoints, the health workflow and dead migration code**

```bash
git rm app/routes/api.scrape-games.ts app/routes/api.compute-stats.ts app/routes/api.migrate-games.ts app/tests/integration/scrape-games.integration.spec.ts workflows/health.ts server/routes/api/workflows/health.post.ts
```

**`app/services/game-service.server.ts`:**
- Delete the `migrateGamesToDatabase` method.
- Delete the imports it alone used: `fetchGames`, `createGameSlug`, `Game` and `calculateRevenue`. Keep each one only if something else in the file still uses it.

**`app/games/index.ts`:**
- Delete `fetchGames` and the `let games: GameDetails[] | undefined` line.

**`scripts/parity.ts`:**
- Delete the `'/api/scrape-games'`, `'/api/compute-stats'` and `'/api/migrate-games'` entries.

Run `pnpm typecheck`. If anything still imports a deleted module or `fetchGames`, remove that reference as well. The Grep tool can find leftovers: `api.scrape-games|api.compute-stats|api.migrate-games|fetchGames|migrateGamesToDatabase|workflows/health`.

- [ ] **Step 4: Gates, then commit**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all pass.

```bash
git add -A app scripts server workflows
git commit -m "refactor: replace the scrape and stats endpoints with a stats job module"
```

---

### Task 3: Harden the Steam client

**Files:**
- Modify: `app/steam/store-api.ts`
- Test: `app/steam/store-api.spec.ts` (rewrite)

**Interfaces:**
- Produces (signatures change, and the `RequestOptions` type is removed):

  ```ts
  fetchAppIdPage(apiKey: string, lastAppId: number, maxResults: number): Promise<AppIdPage>
  fetchStoreItems(appIds: number[]): Promise<StoreItemsResult>   // a 429 rejects with RetryableError
  fetchTagList(): Promise<SteamTag[]>
  ```

- [ ] **Step 1: Replace `app/steam/store-api.spec.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { RetryableError } from 'workflow'

import { fetchAppIdPage, fetchStoreItems, fetchTagList } from '~/steam/store-api'

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

function errorResponse(status: number) {
  return { ok: false, status, json: async () => ({}) } as Response
}

describe('store api', () => {
  let fetchMock: MockInstance

  beforeEach(() => {
    fetchMock = vi.spyOn(global, 'fetch')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.STEAM_RATE_LIMIT_RETRY_AFTER_MS
  })

  it('skips only the failing batch and reports its ids.', async () => {
    const appIds = Array.from({ length: 250 }, (_, index) => index + 1)

    fetchMock
      .mockResolvedValueOnce(
        okResponse({ response: { store_items: [{ appid: 1 }, { appid: 2 }] } })
      )
      .mockResolvedValueOnce(errorResponse(500))

    const result = await fetchStoreItems(appIds)

    expect(result.items).toEqual([{ appid: 1 }, { appid: 2 }])
    expect(result.failedIds).toEqual(appIds.slice(200))
  })

  it('records a batch whose request throws as failed.', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'))

    const result = await fetchStoreItems([1, 2])

    expect(result.failedIds).toEqual([1, 2])
  })

  it('never leaks the api key in error messages.', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(403))

    const error = await fetchAppIdPage('SECRET', 0, 10).catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).not.toContain('SECRET')
    expect(error.message).not.toContain('key=')
  })

  it('gives every request a timeout signal.', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ response: { tags: [] } }))

    await fetchTagList()

    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('turns a rate limit into a retryable error that waits a minute.', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(429))

    const before = Date.now()
    const error = await fetchTagList().catch((e) => e)

    expect(RetryableError.is(error)).toBe(true)
    expect(error.retryAfter.getTime() - before).toBeGreaterThanOrEqual(59_000)
  })

  it('uses the configured rate limit wait when one is set.', async () => {
    process.env.STEAM_RATE_LIMIT_RETRY_AFTER_MS = '10'
    fetchMock.mockResolvedValueOnce(errorResponse(429))

    const before = Date.now()
    const error = await fetchTagList().catch((e) => e)

    expect(error.retryAfter.getTime() - before).toBeLessThan(1_000)
  })

  it('lets a rate limit escape the batch loop instead of recording it as failed.', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(429))

    const error = await fetchStoreItems([1, 2]).catch((e) => e)

    expect(RetryableError.is(error)).toBe(true)
  })

  it('uses last_appid as the next cursor when Steam sends it.', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({
        response: { apps: [{ appid: 10 }], have_more_results: true, last_appid: 12 }
      })
    )

    expect(await fetchAppIdPage('k', 0, 10)).toEqual({
      appIds: [10],
      lastAppId: 12,
      haveMoreResults: true
    })
  })

  it('falls back to the last app, then to the requested cursor, never to 0.', async () => {
    fetchMock
      .mockResolvedValueOnce(
        okResponse({ response: { apps: [{ appid: 7 }, { appid: 9 }], have_more_results: true } })
      )
      .mockResolvedValueOnce(okResponse({ response: { have_more_results: true } }))

    expect((await fetchAppIdPage('k', 5, 10)).lastAppId).toBe(9)
    expect((await fetchAppIdPage('k', 500, 10)).lastAppId).toBe(500)
  })
})
```

Run: `pnpm vitest run app/steam/store-api.spec.ts`
Expected: FAIL on the timeout, retryable and fallback tests.

- [ ] **Step 2: Rewrite `app/steam/store-api.ts`**

```ts
import { RetryableError } from 'workflow'

import type { SteamTag, StoreItem } from '~/steam/types'

export interface AppIdPage {
  appIds: number[]
  lastAppId: number
  haveMoreResults: boolean
}

export interface StoreItemsResult {
  items: StoreItem[]
  failedIds: number[]
}

// GetItems accepts ~250 ids before the GET URL gets too long; stay below it.
const storeItemsBatchSize = 200
// A hung Steam call must not hold a step open indefinitely.
const requestTimeoutMs = 30_000

function rateLimitRetryAfterMs(): number {
  // Tests shorten the wait; production waits a minute before the step retries.
  const configured = Number(process.env.STEAM_RATE_LIMIT_RETRY_AFTER_MS)

  return configured > 0 ? configured : 60_000
}

export async function fetchAppIdPage(
  apiKey: string,
  lastAppId: number,
  maxResults: number
): Promise<AppIdPage> {
  const params = new URLSearchParams({
    key: apiKey,
    include_games: 'true',
    last_appid: String(lastAppId),
    max_results: String(maxResults)
  })

  const data = await getJson<{
    response: {
      apps?: { appid: number }[]
      have_more_results?: boolean
      last_appid?: number
    }
  }>(`https://api.steampowered.com/IStoreService/GetAppList/v1/?${params}`)

  const apps = data.response.apps ?? []

  return {
    appIds: apps.map(({ appid }) => appid),
    // Fall back to the requested cursor so an empty page never rewinds to 0.
    lastAppId:
      data.response.last_appid ?? apps[apps.length - 1]?.appid ?? lastAppId,
    haveMoreResults: Boolean(data.response.have_more_results)
  }
}

export async function fetchStoreItems(
  appIds: number[]
): Promise<StoreItemsResult> {
  const items: StoreItem[] = []
  const failedIds: number[] = []

  for (let start = 0; start < appIds.length; start += storeItemsBatchSize) {
    const batch = appIds.slice(start, start + storeItemsBatchSize)

    const input = {
      ids: batch.map((appid) => ({ appid })),
      context: { language: 'english', country_code: 'US' },
      data_request: {
        include_basic_info: true,
        include_release: true,
        include_reviews: true,
        include_screenshots: true,
        include_tag_count: 20
      }
    }

    try {
      const data = await getJson<{ response: { store_items?: StoreItem[] } }>(
        `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(
          JSON.stringify(input)
        )}`
      )

      items.push(...(data.response.store_items ?? []))
    } catch (error) {
      // A rate limit fails the whole step so the runtime retries it later.
      if (RetryableError.is(error)) {
        throw error
      }

      // Skip just this batch rather than losing the whole chunk.
      console.error(
        `Failed to fetch store items for ${batch.length} ids starting at app id ${batch[0]}.`
      )
      console.error(error)

      failedIds.push(...batch)
    }
  }

  return { items, failedIds }
}

export async function fetchTagList(): Promise<SteamTag[]> {
  const data = await getJson<{ response: { tags?: SteamTag[] } }>(
    'https://api.steampowered.com/IStoreService/GetTagList/v1/?language=english'
  )

  return data.response.tags ?? []
}

async function getJson<T>(url: string): Promise<T> {
  // Strip the query string so the API key never reaches the logs.
  const endpoint = url.split('?')[0]

  const response = await fetch(url, {
    signal: AbortSignal.timeout(requestTimeoutMs)
  })

  if (response.status === 429) {
    throw new RetryableError(`Steam rate limited the request: ${endpoint}`, {
      retryAfter: rateLimitRetryAfterMs()
    })
  }

  if (!response.ok) {
    throw new Error(`Steam request failed with ${response.status}: ${endpoint}`)
  }

  return (await response.json()) as T
}
```

Run: `pnpm vitest run app/steam/store-api.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 3: Gates, then commit**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all pass. `scripts/seed-local.ts` doesn't use these functions; if typecheck flags another caller of the removed options, drop the options argument there.

```bash
git add app/steam/store-api.ts app/steam/store-api.spec.ts
git commit -m "fix: time out steam requests and hand rate limits to the workflow"
```

---

### Task 4: Tag sync, app listing and game upserts

**Files:**
- Create:
  - `app/scrape/chunk.ts`
  - `app/scrape/sync-tags.ts`
  - `app/scrape/list-app-ids.ts`
  - `app/scrape/scrape-ids.ts`
- Modify:
  - `app/market/tag-slugs.ts`
  - `app/steam/build-game-upsert.ts`
  - `app/db/index.ts`: add the `listedAt` index
- Test:
  - `app/scrape/chunk.spec.ts`
  - `app/market/tag-slugs.spec.ts` (add cases)
  - `app/steam/build-game-upsert.spec.ts` (update)
  - `app/tests/integration/scrape-modules.integration.spec.ts`

**Interfaces:**
- Consumes `fetchAppIdPage`, `fetchStoreItems` and `fetchTagList` (Task 3), plus `ChunkResult` (Task 1).
- Produces:

  ```ts
  chunk<T>(items: readonly T[], size: number): T[][]                        // ~/scrape/chunk
  assignTagSlugs(tags: SteamTag[], existing: TagSlug[]): TagSlug[]          // ~/market/tag-slugs
  syncTags(): Promise<number>                                               // ~/scrape/sync-tags
  listAppIds(apiKey: string, runStartedAt: number): Promise<number[]>       // ~/scrape/list-app-ids
  scrapeIds(appIds: number[], runStartedAt: number): Promise<ChunkResult>   // ~/scrape/scrape-ids
  buildGameUpsert(game: ScrapedGame, now: number, newId: string, listedAt: number): GameUpsertOperation
  ```

- [ ] **Step 1: `chunk` test and implementation**

`app/scrape/chunk.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { chunk } from '~/scrape/chunk'

describe('chunk', () => {
  it('splits items into chunks of the given size, keeping the remainder.', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('returns no chunks for no items.', () => {
    expect(chunk([], 3)).toEqual([])
  })

  it('rejects a size that is not a positive integer.', () => {
    expect(() => chunk([1], 0)).toThrow('positive integer')
  })
})
```

`app/scrape/chunk.ts`:

```ts
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`Chunk size must be a positive integer, got ${size}.`)
  }

  const chunks: T[][] = []

  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size))
  }

  return chunks
}
```

Run: `pnpm vitest run app/scrape/chunk.spec.ts`
Expected: PASS.

- [ ] **Step 2: Stable tag slugs**

Add to `app/market/tag-slugs.spec.ts`, inside the existing `describe`, and import `assignTagSlugs` beside `createTagSlugs`:

```ts
  it('keeps the published slug of an existing tag and updates its name.', () => {
    expect(
      assignTagSlugs(
        [{ tagid: 19, name: 'Action Games' }],
        [{ tagId: 19, name: 'Action', slug: 'action' }]
      )
    ).toEqual([{ tagId: 19, name: 'Action Games', slug: 'action' }])
  })

  it('suffixes a new lower-id tag instead of taking an existing slug.', () => {
    expect(
      assignTagSlugs(
        [
          { tagid: 500, name: 'Indie' },
          { tagid: 3, name: 'Indie' }
        ],
        [{ tagId: 500, name: 'Indie', slug: 'indie' }]
      )
    ).toEqual([
      { tagId: 3, name: 'Indie', slug: 'indie-3' },
      { tagId: 500, name: 'Indie', slug: 'indie' }
    ])
  })
```

Replace `createTagSlugs` in `app/market/tag-slugs.ts` with:

```ts
export function assignTagSlugs(
  tags: SteamTag[],
  existing: TagSlug[]
): TagSlug[] {
  const publishedSlugs = new Map(existing.map(({ tagId, slug }) => [tagId, slug]))
  const taken = new Set(existing.map(({ slug }) => slug))

  return [...tags]
    .sort((a, b) => a.tagid - b.tagid)
    .map(({ tagid, name }) => {
      // A tag keeps the slug it was published under, so its URL never moves.
      const published = publishedSlugs.get(tagid)

      if (published) {
        return { tagId: tagid, name, slug: published }
      }

      const base = slugify(name, { lower: true, strict: true }) || `tag-${tagid}`
      const slug = taken.has(base) ? `${base}-${tagid}` : base

      taken.add(slug)

      return { tagId: tagid, name, slug }
    })
}

export function createTagSlugs(tags: SteamTag[]): TagSlug[] {
  return assignTagSlugs(tags, [])
}
```

Run: `pnpm vitest run app/market/tag-slugs.spec.ts`
Expected: PASS, including the 3 existing tests.

- [ ] **Step 3: Upserts clear stale fields and carry `listedAt`**

In `app/steam/build-game-upsert.spec.ts`:
- Change every `buildGameUpsert(x, y, z)` call to pass a fourth argument, `1690000000000`.
- Add `listedAt: 1690000000000,` to the expected `$set`, right after `updatedAt`.
- Replace the test `'omits undefined optional fields instead of writing nulls.'` with:

```ts
  it('unsets optional fields Steam no longer reports instead of keeping stale values.', () => {
    const operation = buildGameUpsert(
      {
        ...game,
        releaseDate: undefined,
        releaseYear: undefined,
        percentPositive: undefined
      },
      1,
      'id',
      1
    )

    const keys = Object.keys(operation.updateOne.update.$set)

    expect(keys).not.toContain('releaseDate')
    expect(keys).not.toContain('releaseYear')
    expect(keys).not.toContain('percentPositive')
    expect(operation.updateOne.update.$unset).toEqual({
      releaseDate: '',
      releaseYear: '',
      percentPositive: ''
    })
  })

  it('leaves out $unset when every field is present.', () => {
    expect(
      buildGameUpsert(game, 1, 'id', 1).updateOne.update.$unset
    ).toBeUndefined()
  })
```

Change `app/steam/build-game-upsert.ts` as follows:

1. In the `GameUpsertOperation` interface, add `$unset?: Record<string, ''>` under `$set`.
2. Change the signature to `buildGameUpsert(game: ScrapedGame, now: number, newId: string, listedAt: number)`.
3. Add `listedAt,` to `fields`, after `updatedAt: now,`.
4. Replace everything from `const $set` to the end of the function with:

```ts
  const entries = Object.entries(fields)
  const $set = Object.fromEntries(
    entries.filter(([, value]) => value !== undefined)
  )
  // Clear values Steam no longer reports, so a rescrape never keeps stale data.
  const $unset = Object.fromEntries(
    entries
      .filter(([, value]) => value === undefined)
      .map(([key]) => [key, ''] as const)
  )

  return {
    updateOne: {
      filter: { gameId: game.gameId },
      update: {
        $set,
        ...(Object.keys($unset).length > 0 ? { $unset } : {}),
        $setOnInsert: {
          _id: newId,
          createdAt: now,
          'details.categories': [],
          'details.genres': [],
          'details.metacritic': {}
        }
      },
      upsert: true
    }
  }
```

`scripts/seed-local.ts` also calls `buildGameUpsert`. Pass `now` as its fourth argument there.

Run: `pnpm vitest run app/steam/build-game-upsert.spec.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing integration test for sync, listing and scraping**

`app/tests/integration/scrape-modules.integration.spec.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { listAppIds } from '~/scrape/list-app-ids'
import { scrapeIds } from '~/scrape/scrape-ids'
import { syncTags } from '~/scrape/sync-tags'
import type { StoreItem } from '~/steam/types'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

beforeEach(async () => {
  for (const name of ['games', 'tags']) {
    await (await getCollection(name)).deleteMany({})
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  })
}

function storeItem(appId: number, withReviews = true): StoreItem {
  return {
    id: appId,
    appid: appId,
    success: 1,
    name: `Game ${appId}`,
    tags: [{ tagid: 19, weight: 100 }],
    ...(withReviews
      ? { reviews: { summary_filtered: { review_count: 100, percent_positive: 90 } } }
      : {}),
    release: { steam_release_date: 1_600_000_000 },
    basic_info: {
      short_description: 'A game.',
      developers: [{ name: 'Dev' }],
      publishers: [{ name: 'Pub' }]
    },
    best_purchase_option: { final_price_in_cents: '999' }
  }
}

function requestedIds(url: string): number[] {
  const input = JSON.parse(decodeURIComponent(url.split('input_json=')[1])) as {
    ids: { appid: number }[]
  }

  return input.ids.map(({ appid }) => appid)
}

describe('syncTags (real MongoDB)', () => {
  it('keeps published slugs and inserts new tags with a zero game count.', async () => {
    const tags = await getCollection('tags')

    await tags.insertOne({ tagId: 500, name: 'Indie', slug: 'indie', gameCount: 7 })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        response: {
          tags: [
            { tagid: 3, name: 'Indie' },
            { tagid: 500, name: 'Indie' }
          ]
        }
      })
    )

    expect(await syncTags()).toBe(2)

    const documents = await tags
      .find({})
      .project({ _id: 0 })
      .sort({ tagId: 1 })
      .toArray()

    expect(documents).toEqual([
      { tagId: 3, name: 'Indie', slug: 'indie-3', gameCount: 0 },
      { tagId: 500, name: 'Indie', slug: 'indie', gameCount: 7 }
    ])
  })
})

describe('listAppIds (real MongoDB)', () => {
  it('pages until Steam has no more results, dropping ignored ids.', async () => {
    const cursors: string[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const cursor = new URL(String(input)).searchParams.get('last_appid') ?? ''

      cursors.push(cursor)

      return cursor === '0'
        ? jsonResponse({
            response: {
              apps: [{ appid: 10 }, { appid: 216938 }],
              have_more_results: true,
              last_appid: 216938
            }
          })
        : jsonResponse({
            response: { apps: [{ appid: 300000 }], have_more_results: false }
          })
    })

    expect(await listAppIds('test-key', 1)).toEqual([10, 300000])
    expect(cursors).toEqual(['0', '216938'])
  })

  it('stops on an empty page that claims more results.', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        jsonResponse({ response: { have_more_results: true } })
      )

    expect(await listAppIds('test-key', 1)).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stops when the cursor would not move forward.', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        jsonResponse({
          response: { apps: [{ appid: 5 }], have_more_results: true, last_appid: 0 }
        })
      )

    expect(await listAppIds('test-key', 1)).toEqual([5])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('marks listed games and clears their delisted flag.', async () => {
    const games = await getCollection('games')

    await games.insertMany([
      { gameId: 10, slug: 'a', delistedAt: 1 },
      { gameId: 11, slug: 'b' }
    ])

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ response: { apps: [{ appid: 10 }], have_more_results: false } })
    )

    await listAppIds('test-key', 1234)

    const listed = await games.findOne({ gameId: 10 })
    const unlisted = await games.findOne({ gameId: 11 })

    expect(listed?.listedAt).toBe(1234)
    expect(listed).not.toHaveProperty('delistedAt')
    expect(unlisted).not.toHaveProperty('listedAt')
  })
})

describe('scrapeIds (real MongoDB)', () => {
  it('upserts games, reports failed batches, and unsets fields on rescrape.', async () => {
    let withReviews = true

    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const ids = requestedIds(String(input))

      if (ids.includes(999)) {
        return new Response('', { status: 500 })
      }

      return jsonResponse({
        response: { store_items: ids.map((id) => storeItem(id, withReviews)) }
      })
    })

    const ids = [...Array.from({ length: 200 }, (_, index) => index + 1), 999]

    expect(await scrapeIds(ids, 77)).toEqual({ saved: 200, failedIds: [999] })

    const games = await getCollection('games')
    const first = await games.findOne({ gameId: 1 })

    expect(first).toMatchObject({ listedAt: 77, percentPositive: 90 })

    withReviews = false

    await scrapeIds([1], 78)

    const rescraped = await games.findOne({ gameId: 1 })

    expect(await games.countDocuments({ gameId: 1 })).toBe(1)
    expect(rescraped?.listedAt).toBe(78)
    expect(rescraped).not.toHaveProperty('percentPositive')
  })
})
```

Run: `pnpm vitest run app/tests/integration/scrape-modules.integration.spec.ts`
Expected: FAIL, because the modules cannot be resolved.

- [ ] **Step 5: Implement the three modules and the index**

`app/scrape/sync-tags.ts`:

```ts
import { getCollection } from '~/db'
import { assignTagSlugs, type TagSlug } from '~/market/tag-slugs'
import { fetchTagList } from '~/steam/store-api'

export async function syncTags(): Promise<number> {
  const steamTags = await fetchTagList()

  if (steamTags.length === 0) {
    return 0
  }

  const collection = await getCollection('tags')
  const existing = (await collection
    .find({})
    .project({ _id: 0, tagId: 1, name: 1, slug: 1 })
    .toArray()) as TagSlug[]

  const tags = assignTagSlugs(steamTags, existing)

  await collection.bulkWrite(
    tags.map(({ tagId, name, slug }) => ({
      updateOne: {
        filter: { tagId },
        update: {
          $set: { name, slug },
          $setOnInsert: { gameCount: 0 }
        },
        upsert: true
      }
    })),
    { ordered: false }
  )

  return tags.length
}
```

`app/scrape/list-app-ids.ts`:

```ts
import { getCollection } from '~/db'
import { chunk } from '~/scrape/chunk'
import { ignoredAppIds } from '~/steam/ignored-app-ids'
import { fetchAppIdPage } from '~/steam/store-api'

// GetAppList's largest page.
const appListPageSize = 50_000
const updateSliceSize = 10_000

export async function listAppIds(
  apiKey: string,
  runStartedAt: number
): Promise<number[]> {
  const seen = new Set<number>()
  let cursor = 0

  for (;;) {
    const page = await fetchAppIdPage(apiKey, cursor, appListPageSize)

    for (const appId of page.appIds) {
      seen.add(appId)
    }

    // Stop on the last page, and on a page that cannot advance the cursor.
    if (!page.haveMoreResults || page.lastAppId <= cursor) {
      break
    }

    cursor = page.lastAppId
  }

  const appIds = [...seen]
    .filter((appId) => !ignoredAppIds.has(appId))
    .sort((a, b) => a - b)

  const games = await getCollection('games')

  for (const slice of chunk(appIds, updateSliceSize)) {
    await games.updateMany(
      { gameId: { $in: slice } },
      { $set: { listedAt: runStartedAt }, $unset: { delistedAt: '' } }
    )
  }

  return appIds
}
```

`app/scrape/scrape-ids.ts`:

```ts
import { ObjectId } from 'mongodb'

import { getCollection } from '~/db'
import type { ChunkResult } from '~/scrape/run-record'
import { buildGameUpsert } from '~/steam/build-game-upsert'
import { mapStoreItem, type ScrapedGame } from '~/steam/map-store-item'
import { fetchStoreItems } from '~/steam/store-api'

export async function scrapeIds(
  appIds: number[],
  runStartedAt: number
): Promise<ChunkResult> {
  const { items, failedIds } = await fetchStoreItems(appIds)

  const games = items
    .map(mapStoreItem)
    .filter((game): game is ScrapedGame => Boolean(game))

  if (games.length > 0) {
    const collection = await getCollection('games')
    const now = Date.now()

    await collection.bulkWrite(
      games.map((game) =>
        buildGameUpsert(game, now, new ObjectId().toHexString(), runStartedAt)
      ),
      { ordered: false }
    )
  }

  return { saved: games.length, failedIds }
}
```

In `app/db/index.ts` `ensureIndexes`, add `games.createIndex({ listedAt: 1 }),` after the `basePrice` index.

Run: `pnpm vitest run app/tests/integration/scrape-modules.integration.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Gates, then commit**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all pass.

```bash
git add app/scrape app/market/tag-slugs.ts app/market/tag-slugs.spec.ts app/steam/build-game-upsert.ts app/steam/build-game-upsert.spec.ts app/db/index.ts app/tests/integration/scrape-modules.integration.spec.ts scripts/seed-local.ts
git commit -m "feat: add tag sync, app listing and chunk scraping modules"
```

---

### Task 5: Guarded delisting

**Files:**
- Create: `app/scrape/mark-delisted.ts`
- Test: `app/tests/integration/mark-delisted.integration.spec.ts`

**Interfaces:**
- Consumes `DelistedResult` (Task 1).
- Produces `markDelisted(runStartedAt: number, listed: number): Promise<DelistedResult>` in `~/scrape/mark-delisted`.

- [ ] **Step 1: Write the failing test**

`app/tests/integration/mark-delisted.integration.spec.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { markDelisted } from '~/scrape/mark-delisted'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

beforeEach(async () => {
  await (await getCollection('games')).deleteMany({})
})

async function seedGames(listed: number, unlisted: number, runStartedAt: number) {
  const games = await getCollection('games')

  await games.insertMany([
    ...Array.from({ length: listed }, (_, index) => ({
      gameId: index + 1,
      details: { name: `Listed ${index + 1}` },
      listedAt: runStartedAt
    })),
    ...Array.from({ length: unlisted }, (_, index) => ({
      gameId: 10_000 + index,
      details: { name: `Gone ${index}` },
      listedAt: 1
    }))
  ])
}

describe('markDelisted (real MongoDB)', () => {
  it('flags only games this run did not list, leaving their data intact.', async () => {
    await seedGames(95, 5, 500)

    expect(await markDelisted(500, 95)).toEqual({ count: 5 })

    const games = await getCollection('games')
    const gone = await games.findOne({ gameId: 10_000 })

    expect(gone).toMatchObject({ delistedAt: 500, details: { name: 'Gone 0' } })
    expect(await games.countDocuments({ delistedAt: { $exists: true } })).toBe(5)
  })

  it('keeps the original delisting time for games already flagged.', async () => {
    const games = await getCollection('games')

    await games.insertOne({ gameId: 1, listedAt: 1, delistedAt: 42 })

    expect(await markDelisted(500, 1)).toEqual({ count: 0 })
    expect((await games.findOne({ gameId: 1 }))?.delistedAt).toBe(42)
  })

  it('skips flagging when the list looks truncated.', async () => {
    await seedGames(50, 50, 500)

    expect(await markDelisted(500, 50)).toEqual({
      skipped: true,
      listed: 50,
      active: 100
    })

    const games = await getCollection('games')

    expect(await games.countDocuments({ delistedAt: { $exists: true } })).toBe(0)
  })
})
```

Run: `pnpm vitest run app/tests/integration/mark-delisted.integration.spec.ts`
Expected: FAIL, because the module cannot be resolved.

- [ ] **Step 2: Implement `app/scrape/mark-delisted.ts`**

```ts
import { getCollection } from '~/db'
import type { DelistedResult } from '~/scrape/run-record'

// A list shorter than this share of the active games is treated as a bad
// response from Steam, not as mass delisting.
const minimumListedShare = 0.9

export async function markDelisted(
  runStartedAt: number,
  listed: number
): Promise<DelistedResult> {
  const games = await getCollection('games')
  const active = await games.countDocuments({ delistedAt: { $exists: false } })

  if (listed < minimumListedShare * active) {
    console.error(
      `Skipping delisting: Steam listed ${listed} games but ${active} are active.`
    )

    return { skipped: true, listed, active }
  }

  // Delisted games keep all their data; the flag only records when they left Steam.
  const result = await games.updateMany(
    { listedAt: { $ne: runStartedAt }, delistedAt: { $exists: false } },
    { $set: { delistedAt: runStartedAt } }
  )

  return { count: result.modifiedCount }
}
```

Run: `pnpm vitest run app/tests/integration/mark-delisted.integration.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 3: Gates, then commit**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all pass.

```bash
git add app/scrape/mark-delisted.ts app/tests/integration/mark-delisted.integration.spec.ts
git commit -m "feat: flag games steam no longer lists"
```

---

### Task 6: Full workflow orchestration

**Files:**
- Modify:
  - `workflows/scrape-games-steps.ts`
  - `workflows/scrape-games.ts`
- Test: `workflows/scrape-games.spec.ts` (rewrite)

**Interfaces:**
- Consumes everything from Tasks 1–5:
  - `syncTags`, `listAppIds`, `scrapeIds`, `markDelisted`
  - `computeAndSaveStats`
  - `chunk`
  - the run-record functions
- Produces the final `scrapeGames` behaviour, which Task 7's route starts.

- [ ] **Step 1: Replace `workflows/scrape-games.spec.ts` with the orchestration tests**

```ts
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { start } from 'workflow/api'

import { getCollection, resetDatabaseConnection } from '~/db'
import { findRun } from '~/scrape/run-record'
import type { StoreItem } from '~/steam/types'

import { scrapeGames } from './scrape-games'

interface FakeSteam {
  appIds: number[]
  withReviews?: boolean
  freeIds?: number[]
  // Return a status to fail a GetItems call for these ids.
  getItemsStatus?: (appIds: number[]) => number | undefined
  tagListGate?: Promise<void>
}

const realFetch = globalThis.fetch

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  })
}

function storeItem(appId: number, fake: FakeSteam): StoreItem {
  return {
    id: appId,
    appid: appId,
    success: 1,
    name: `Game ${appId}`,
    is_free: fake.freeIds?.includes(appId) ?? false,
    tags: [{ tagid: 19, weight: 100 }],
    ...(fake.withReviews === false
      ? {}
      : { reviews: { summary_filtered: { review_count: 100, percent_positive: 90 } } }),
    release: { steam_release_date: 1_600_000_000 },
    basic_info: {
      short_description: 'A game.',
      developers: [{ name: 'Dev' }],
      publishers: [{ name: 'Pub' }]
    },
    best_purchase_option: { final_price_in_cents: '999' }
  }
}

function installFakeSteam(fake: FakeSteam) {
  const calls = { tagList: 0, getItems: 0 }

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)

    if (!url.startsWith('https://api.steampowered.com/')) {
      return realFetch(input, init)
    }

    if (url.includes('GetTagList')) {
      calls.tagList += 1
      await fake.tagListGate

      return jsonResponse({ response: { tags: [{ tagid: 19, name: 'Action' }] } })
    }

    if (url.includes('GetAppList')) {
      const params = new URL(url).searchParams
      const after = Number(params.get('last_appid'))
      const max = Number(params.get('max_results'))
      const remaining = fake.appIds.filter((appId) => appId > after)
      const page = remaining.slice(0, max)

      return jsonResponse({
        response: {
          apps: page.map((appid) => ({ appid })),
          have_more_results: remaining.length > page.length,
          last_appid: page[page.length - 1]
        }
      })
    }

    if (url.includes('GetItems')) {
      calls.getItems += 1

      const ids = (
        JSON.parse(decodeURIComponent(url.split('input_json=')[1])) as {
          ids: { appid: number }[]
        }
      ).ids.map(({ appid }) => appid)
      const status = fake.getItemsStatus?.(ids)

      if (status) {
        return new Response('', { status })
      }

      return jsonResponse({
        response: { store_items: ids.map((appId) => storeItem(appId, fake)) }
      })
    }

    throw new Error(`Unexpected Steam call: ${url.split('?')[0]}`)
  })

  return calls
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
}

async function runToCompletion() {
  const run = await start(scrapeGames, [{ trigger: 'manual' }])
  const result = await run.returnValue

  return { run, result, record: await findRun(run.runId) }
}

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
  process.env.STEAM_API_KEY = 'test-steam-key'
  process.env.STEAM_RATE_LIMIT_RETRY_AFTER_MS = '10'
})

afterAll(async () => {
  await resetDatabaseConnection()
})

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})

  for (const name of ['games', 'tags', 'scrapeRuns', 'marketStats']) {
    await (await getCollection(name)).deleteMany({})
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('scrapeGames workflow', () => {
  it('scrapes every chunk, computes stats and records a succeeded run.', async () => {
    installFakeSteam({ appIds: range(1, 2500) })

    const { run, result, record } = await runToCompletion()

    expect(result).toEqual({ skipped: false, runId: run.runId })
    expect(record).toMatchObject({
      trigger: 'manual',
      status: 'succeeded',
      listed: 2500,
      delisted: { count: 0 },
      stats: { games: 2500, tags: 1 }
    })
    expect(Object.keys(record?.chunks ?? {})).toEqual(['0', '1', '2'])
    expect(record?.retry).toBeUndefined()

    const games = await getCollection('games')

    expect(await games.countDocuments({})).toBe(2500)
    expect(await games.countDocuments({ listedAt: record?.startedAt.getTime() })).toBe(2500)
    expect(await (await getCollection('tags')).findOne({ tagId: 19 })).toMatchObject({
      slug: 'action'
    })
  })

  it('recovers a failed batch in the retry pass.', async () => {
    let failed = false

    installFakeSteam({
      appIds: range(1, 300),
      getItemsStatus: (ids) => {
        if (!failed && ids.includes(1)) {
          failed = true

          return 500
        }
      }
    })

    const { record } = await runToCompletion()

    expect(record?.chunks?.['0'].failedIds).toEqual(range(1, 200))
    expect(record?.retry).toEqual({ attempted: 200, saved: 200, stillFailed: [] })
    expect(await (await getCollection('games')).countDocuments({})).toBe(300)
  })

  it('keeps going when a chunk exhausts its retries and records the ids.', async () => {
    installFakeSteam({
      appIds: range(1, 1100),
      getItemsStatus: (ids) => (ids.includes(1) ? 429 : undefined)
    })

    const { record } = await runToCompletion()

    expect(record?.status).toBe('succeeded')
    expect(record?.chunks?.['0']).toEqual({ saved: 0, failedIds: range(1, 1000) })
    expect(record?.chunks?.['1'].saved).toBe(100)
    expect(record?.retry).toEqual({
      attempted: 1000,
      saved: 0,
      stillFailed: range(1, 1000)
    })
  })

  it('flags unlisted games, unflags returning ones and leaves listed free games alone.', async () => {
    const games = await getCollection('games')

    await games.insertMany([
      { gameId: 9999, slug: 'gone', details: { name: 'Gone Game' } },
      { gameId: 5, slug: 'back', details: { name: 'Back' }, delistedAt: 1 },
      { gameId: 7, slug: 'free', details: { name: 'Free Now' } }
    ])

    installFakeSteam({ appIds: range(1, 100), freeIds: [7] })

    const { record } = await runToCompletion()
    const startedAt = record?.startedAt.getTime()

    expect(record?.delisted).toEqual({ count: 1 })
    expect(await games.findOne({ gameId: 9999 })).toMatchObject({
      delistedAt: startedAt,
      details: { name: 'Gone Game' }
    })
    expect(await games.findOne({ gameId: 5 })).not.toHaveProperty('delistedAt')
    expect(await games.findOne({ gameId: 7 })).not.toHaveProperty('delistedAt')
  })

  it('skips delisting when Steam returns a truncated list.', async () => {
    await (await getCollection('games')).insertMany(
      range(1, 100).map((gameId) => ({ gameId, slug: `game-${gameId}` }))
    )

    installFakeSteam({ appIds: range(1, 50) })

    const { record } = await runToCompletion()

    expect(record?.delisted).toEqual({ skipped: true, listed: 50, active: 100 })
    expect(
      await (await getCollection('games')).countDocuments({ delistedAt: { $exists: true } })
    ).toBe(0)
  })

  it('skips a second run while the first is still active.', async () => {
    let release = () => {}
    const tagListGate = new Promise<void>((resolve) => {
      release = resolve
    })
    const calls = installFakeSteam({ appIds: range(1, 10), tagListGate })

    const first = await start(scrapeGames, [{ trigger: 'cron' }])

    await vi.waitFor(() => expect(calls.tagList).toBe(1), { timeout: 30_000 })

    const second = await start(scrapeGames, [{ trigger: 'manual' }])

    expect(await second.returnValue).toEqual({
      skipped: true,
      activeRunId: first.runId
    })

    release()

    expect(await first.returnValue).toEqual({ skipped: false, runId: first.runId })
    expect(await findRun(second.runId)).toBeNull()
  })

  it('runs again after a finished run and unsets fields Steam stopped reporting.', async () => {
    installFakeSteam({ appIds: [1] })
    await runToCompletion()

    const games = await getCollection('games')

    expect((await games.findOne({ gameId: 1 }))?.percentPositive).toBe(90)

    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    installFakeSteam({ appIds: [1], withReviews: false })

    const { result } = await runToCompletion()

    expect(result).toMatchObject({ skipped: false })
    expect(await games.findOne({ gameId: 1 })).not.toHaveProperty('percentPositive')
  })

  it('marks the run failed when the Steam key is missing.', async () => {
    const apiKey = process.env.STEAM_API_KEY

    delete process.env.STEAM_API_KEY
    installFakeSteam({ appIds: [1] })

    try {
      const run = await start(scrapeGames, [{ trigger: 'cron' }])

      await expect(run.returnValue).rejects.toThrow()
      expect(await findRun(run.runId)).toMatchObject({
        status: 'failed',
        error: expect.stringContaining('STEAM_API_KEY')
      })
    } finally {
      process.env.STEAM_API_KEY = apiKey
    }
  })
})
```

Run: `pnpm test:workflows`
Expected: FAIL. The skeleton never calls Steam, so most assertions fail.

- [ ] **Step 2: Add the steps**

Replace `workflows/scrape-games-steps.ts` with:

```ts
import { FatalError } from 'workflow'

import { computeAndSaveStats } from '~/market/compute-and-save-stats.server'
import { listAppIds } from '~/scrape/list-app-ids'
import { markDelisted } from '~/scrape/mark-delisted'
import {
  collectFailedIds,
  finishRun,
  recordChunk,
  startRun,
  summariseRetry,
  updateRun,
  type ChunkField,
  type ScrapeTrigger
} from '~/scrape/run-record'
import { scrapeIds } from '~/scrape/scrape-ids'
import { syncTags } from '~/scrape/sync-tags'

function steamApiKey(): string {
  const apiKey = process.env.STEAM_API_KEY

  if (!apiKey) {
    // Retrying cannot fix missing configuration.
    throw new FatalError('STEAM_API_KEY is not configured.')
  }

  return apiKey
}

export async function startRunStep(
  runId: string,
  trigger: ScrapeTrigger,
  startedAt: number
): Promise<void> {
  'use step'

  await startRun(runId, trigger, startedAt)
}

export async function syncTagsStep(): Promise<number> {
  'use step'

  return syncTags()
}

export async function listAppIdsStep(
  runId: string,
  runStartedAt: number
): Promise<number[]> {
  'use step'

  const appIds = await listAppIds(steamApiKey(), runStartedAt)

  await updateRun(runId, { listed: appIds.length })

  return appIds
}

export async function scrapeChunkStep(
  runId: string,
  field: ChunkField,
  index: number,
  appIds: number[],
  runStartedAt: number
): Promise<void> {
  'use step'

  await recordChunk(runId, field, index, await scrapeIds(appIds, runStartedAt))
}

export async function recordChunkFailureStep(
  runId: string,
  field: ChunkField,
  index: number,
  appIds: number[]
): Promise<void> {
  'use step'

  await recordChunk(runId, field, index, { saved: 0, failedIds: appIds })
}

export async function collectFailedIdsStep(
  runId: string,
  field: ChunkField
): Promise<number[]> {
  'use step'

  return collectFailedIds(runId, field)
}

export async function summariseRetryStep(
  runId: string,
  attempted: number
): Promise<void> {
  'use step'

  await summariseRetry(runId, attempted)
}

export async function markDelistedStep(
  runId: string,
  runStartedAt: number,
  listed: number
): Promise<void> {
  'use step'

  await updateRun(runId, { delisted: await markDelisted(runStartedAt, listed) })
}

export async function computeStatsStep(runId: string): Promise<void> {
  'use step'

  await updateRun(runId, { stats: await computeAndSaveStats() })
}

export async function finishRunStep(
  runId: string,
  status: 'succeeded' | 'failed',
  error?: string
): Promise<void> {
  'use step'

  await finishRun(runId, status, error)
}
```

- [ ] **Step 3: Complete the workflow**

Replace `workflows/scrape-games.ts` with:

```ts
import { createHook, getWorkflowMetadata } from 'workflow'

import { chunk } from '~/scrape/chunk'
import type { ChunkField, ScrapeTrigger } from '~/scrape/run-record'

import {
  collectFailedIdsStep,
  computeStatsStep,
  finishRunStep,
  listAppIdsStep,
  markDelistedStep,
  recordChunkFailureStep,
  scrapeChunkStep,
  startRunStep,
  summariseRetryStep,
  syncTagsStep
} from './scrape-games-steps'

const chunkSize = 1000

export type ScrapeGamesResult =
  | { skipped: true; activeRunId: string }
  | { skipped: false; runId: string }

export async function scrapeGames(input: {
  trigger: ScrapeTrigger
}): Promise<ScrapeGamesResult> {
  'use workflow'

  // A fixed token makes a second run exit before it touches Steam or Mongo.
  // The runtime releases the token when this run ends.
  const hook = createHook({ token: 'scrape-games' })
  const conflict = await hook.getConflict()

  if (conflict) {
    return { skipped: true, activeRunId: conflict.runId }
  }

  const { workflowRunId: runId } = getWorkflowMetadata()
  const runStartedAt = Date.now()

  try {
    await startRunStep(runId, input.trigger, runStartedAt)
    await syncTagsStep()

    const appIds = await listAppIdsStep(runId, runStartedAt)

    await scrapeInChunks(runId, 'chunks', appIds, runStartedAt)

    const failedIds = await collectFailedIdsStep(runId, 'chunks')

    if (failedIds.length > 0) {
      await scrapeInChunks(runId, 'retryChunks', failedIds, runStartedAt)
      await summariseRetryStep(runId, failedIds.length)
    }

    await markDelistedStep(runId, runStartedAt, appIds.length)
    await computeStatsStep(runId)
    await finishRunStep(runId, 'succeeded')

    return { skipped: false, runId }
  } catch (error) {
    await finishRunStep(
      runId,
      'failed',
      error instanceof Error ? error.message : String(error)
    )

    throw error
  }
}

async function scrapeInChunks(
  runId: string,
  field: ChunkField,
  appIds: number[],
  runStartedAt: number
): Promise<void> {
  const chunks = chunk(appIds, chunkSize)

  for (let index = 0; index < chunks.length; index++) {
    try {
      await scrapeChunkStep(runId, field, index, chunks[index], runStartedAt)
    } catch {
      // The step has used up its retries. Record its ids and keep going, so
      // one bad chunk never costs the rest of the catalog.
      await recordChunkFailureStep(runId, field, index, chunks[index])
    }
  }
}
```

Run: `pnpm test:workflows`
Expected: PASS, 8 tests.

If a step error caught in the workflow does not carry the original message (the missing-key test), assert on what the runtime does surface. Check `node_modules/workflow/docs/foundations/errors-and-retries.mdx` first, and record what you find in your report.

- [ ] **Step 4: Gates, then commit**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all pass.

```bash
git add workflows
git commit -m "feat: scrape the full catalog in a durable workflow"
```

---

### Task 7: Trigger endpoint and daily cron

**Files:**
- Create:
  - `app/scrape/trigger-auth.ts`
  - `server/routes/api/workflows/scrape.ts`
- Modify:
  - `vercel.json`
  - `.env.template`
- Test: `app/scrape/trigger-auth.spec.ts`

**Interfaces:**
- Consumes `scrapeGames` (Task 6) and `ScrapeTrigger` (Task 1).
- Produces:

  ```ts
  secretMatches(provided: string | null | undefined, expected: string | undefined): boolean
  authoriseScrapeTrigger(method: string, headers: Headers, env?: Record<string, string | undefined>): ScrapeTrigger | null
  ```

- [ ] **Step 1: Write the failing unit test**

`app/scrape/trigger-auth.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { authoriseScrapeTrigger, secretMatches } from '~/scrape/trigger-auth'

const env = { CRON_SECRET: 'cron-secret', SCRAPE_KEY: 'scrape-key' }

function headers(values: Record<string, string>): Headers {
  return new Headers(values)
}

describe('authoriseScrapeTrigger', () => {
  it('accepts the cron secret as a bearer token on GET.', () => {
    expect(
      authoriseScrapeTrigger('GET', headers({ authorization: 'Bearer cron-secret' }), env)
    ).toBe('cron')
  })

  it('accepts the scrape key header on POST.', () => {
    expect(
      authoriseScrapeTrigger('POST', headers({ 'x-scrape-key': 'scrape-key' }), env)
    ).toBe('manual')
  })

  it('rejects wrong secrets and secrets sent to the other method.', () => {
    expect(
      authoriseScrapeTrigger('GET', headers({ authorization: 'Bearer nope' }), env)
    ).toBeNull()
    expect(
      authoriseScrapeTrigger('GET', headers({ 'x-scrape-key': 'scrape-key' }), env)
    ).toBeNull()
    expect(
      authoriseScrapeTrigger('POST', headers({ authorization: 'Bearer cron-secret' }), env)
    ).toBeNull()
  })

  it('rejects everything when the secrets are not configured.', () => {
    expect(
      authoriseScrapeTrigger('GET', headers({ authorization: 'Bearer ' }), {})
    ).toBeNull()
    expect(
      authoriseScrapeTrigger('POST', headers({ 'x-scrape-key': '' }), {})
    ).toBeNull()
  })

  it('rejects other methods.', () => {
    expect(
      authoriseScrapeTrigger('PUT', headers({ 'x-scrape-key': 'scrape-key' }), env)
    ).toBeNull()
  })
})

describe('secretMatches', () => {
  it('compares secrets of different lengths without throwing.', () => {
    expect(secretMatches('short', 'much-longer-secret')).toBe(false)
    expect(secretMatches('same', 'same')).toBe(true)
  })
})
```

Run: `pnpm vitest run app/scrape/trigger-auth.spec.ts`
Expected: FAIL, because the module cannot be resolved.

- [ ] **Step 2: Implement the auth module and the route**

`app/scrape/trigger-auth.ts`:

```ts
import { timingSafeEqual } from 'node:crypto'

import type { ScrapeTrigger } from '~/scrape/run-record'

export function secretMatches(
  provided: string | null | undefined,
  expected: string | undefined
): boolean {
  if (!provided || !expected) {
    return false
  }

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)

  return a.length === b.length && timingSafeEqual(a, b)
}

export function authoriseScrapeTrigger(
  method: string,
  headers: Headers,
  env: Record<string, string | undefined> = process.env
): ScrapeTrigger | null {
  if (method === 'GET') {
    // Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
    const authorization = headers.get('authorization') ?? ''
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : null

    return secretMatches(token, env.CRON_SECRET) ? 'cron' : null
  }

  if (method === 'POST') {
    return secretMatches(headers.get('x-scrape-key'), env.SCRAPE_KEY)
      ? 'manual'
      : null
  }

  return null
}
```

`server/routes/api/workflows/scrape.ts`:

```ts
import { defineHandler } from 'nitro'
import { start } from 'workflow/api'

import { authoriseScrapeTrigger } from '../../../../app/scrape/trigger-auth'
import { scrapeGames } from '../../../../workflows/scrape-games'

export default defineHandler(async (event) => {
  const trigger = authoriseScrapeTrigger(event.req.method, event.req.headers)

  if (!trigger) {
    return new Response('Unauthorized.', { status: 401 })
  }

  const run = await start(scrapeGames, [{ trigger }])

  return { runId: run.runId }
})
```

Add a top-level `crons` key to `vercel.json`, beside `headers`:

```json
  "crons": [
    {
      "path": "/api/workflows/scrape",
      "schedule": "0 4 * * *"
    }
  ],
```

Append to `.env.template`:

```
CRON_SECRET=
```

Run: `pnpm vitest run app/scrape/trigger-auth.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 3: Check the built route answers 401 without credentials**

Run:

```bash
pnpm build
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity PORT=3999 node build/server/index.mjs &
```

Wait until port 3999 answers, then run:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3999/api/workflows/scrape
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'x-scrape-key: wrong' http://localhost:3999/api/workflows/scrape
```

Expected: `401` twice. Stop the server afterwards. Do not send valid credentials: that would start a real scrape.

- [ ] **Step 4: Gates, then commit**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all pass.

```bash
git add app/scrape/trigger-auth.ts app/scrape/trigger-auth.spec.ts server/routes/api/workflows/scrape.ts vercel.json .env.template
git commit -m "feat: start the scrape workflow from a daily cron"
```

---

### Task 8: Sitemap index

**Files:**
- Create:
  - `app/sitemap/xml.ts`
  - `app/routes/sitemap-pages[.]xml.tsx`
  - `app/routes/sitemap-games.$page.tsx`
- Modify:
  - `app/routes/sitemap[.]xml.tsx` (rewrite)
  - `app/routes/sitemap-tags[.]xml.tsx`: import `escapeXml` from the new module instead of defining it
- Test:
  - `app/sitemap/xml.spec.ts`
  - `app/tests/integration/sitemaps.integration.spec.ts`

**Interfaces:**
- Produces, in `~/sitemap/xml`:

  ```ts
  export const gamesPerSitemap = 40_000
  export const sitemapHeaders: Record<string, string>
  escapeXml(value: string): string
  sitemapPageCount(gameCount: number): number
  renderSitemapIndex(paths: string[], lastmod: string): string
  renderUrlSet(entries: { path: string; priority: string }[], lastmod: string): string
  ```

- [ ] **Step 1: Write the failing unit test**

`app/sitemap/xml.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { renderSitemapIndex, renderUrlSet, sitemapPageCount } from '~/sitemap/xml'

describe('sitemap xml', () => {
  it('needs one game sitemap per 40,000 games, and at least one.', () => {
    expect(sitemapPageCount(0)).toBe(1)
    expect(sitemapPageCount(40_000)).toBe(1)
    expect(sitemapPageCount(40_001)).toBe(2)
  })

  it('renders a sitemap index with absolute locations.', () => {
    const xml = renderSitemapIndex(['/sitemap-games/1'], '2026-10-12T00:00:00.000Z')

    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/sitemap-games/1</loc>')
    expect(xml).toContain('<lastmod>2026-10-12T00:00:00.000Z</lastmod>')
  })

  it('renders url entries with escaped locations.', () => {
    const xml = renderUrlSet([{ path: '/app/1/a&b', priority: '1.0' }], 'now')

    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/app/1/a&amp;b</loc>')
    expect(xml).toContain('<priority>1.0</priority>')
  })
})
```

Run: `pnpm vitest run app/sitemap/xml.spec.ts`
Expected: FAIL, because the module cannot be resolved.

- [ ] **Step 2: Implement `app/sitemap/xml.ts`**

```ts
import { SITE_URL } from '~/market/constants'

// Search engines accept at most 50,000 URLs per sitemap.
export const gamesPerSitemap = 40_000

export const sitemapHeaders: Record<string, string> = {
  'Content-Type': 'application/xml; charset=UTF-8',
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
}

const xmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
}

export const escapeXml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => xmlEntities[character])

export function sitemapPageCount(gameCount: number): number {
  return Math.max(1, Math.ceil(gameCount / gamesPerSitemap))
}

export function renderSitemapIndex(paths: string[], lastmod: string): string {
  const entries = paths
    .map(
      (path) => `
<sitemap>
  <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
  <lastmod>${lastmod}</lastmod>
</sitemap>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}
</sitemapindex>
`
}

export function renderUrlSet(
  entries: { path: string; priority: string }[],
  lastmod: string
): string {
  const urls = entries
    .map(
      ({ path, priority }) => `
<url>
  <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
  <lastmod>${lastmod}</lastmod>
  <priority>${priority}</priority>
</url>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>
`
}
```

In `app/routes/sitemap-tags[.]xml.tsx`:
- Delete the local `xmlEntities` and `escapeXml` definitions.
- Add `import { escapeXml } from '~/sitemap/xml'`.

Run: `pnpm vitest run app/sitemap/xml.spec.ts app/tests/routes/sitemap-tags.spec.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing route integration test**

`app/tests/integration/sitemaps.integration.spec.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { loader as gamesSitemapLoader } from '~/routes/sitemap-games.$page'
import { loader as pagesSitemapLoader } from '~/routes/sitemap-pages[.]xml'
import { loader as indexLoader } from '~/routes/sitemap[.]xml'

beforeAll(async () => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`

  await (await getCollection('games')).insertMany([
    { gameId: 20, slug: 'second' },
    { gameId: 10, slug: 'first' },
    { gameId: 30, slug: 'gone', delistedAt: 1 }
  ])
})

afterAll(async () => {
  await resetDatabaseConnection()
})

function gamesSitemap(page: string) {
  return gamesSitemapLoader({
    params: { page },
    request: new Request(`http://localhost/sitemap-games/${page}`),
    context: {}
  } as any)
}

describe('sitemaps (real MongoDB)', () => {
  it('indexes the tag, page and game sitemaps.', async () => {
    const response = await indexLoader()
    const xml = await response.text()

    expect(response.headers.get('Content-Type')).toContain('application/xml')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/sitemap-tags.xml</loc>')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/sitemap-pages.xml</loc>')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/sitemap-games/1</loc>')
    expect(xml).not.toContain('/sitemap-games/2')
  })

  it('lists games in id order, including delisted ones.', async () => {
    const xml = await (await gamesSitemap('1')).text()

    expect(xml.indexOf('/app/10/first')).toBeGreaterThan(-1)
    expect(xml.indexOf('/app/10/first')).toBeLessThan(xml.indexOf('/app/20/second'))
    expect(xml).toContain('/app/30/gone')
  })

  it('returns 404 for pages that do not exist.', async () => {
    for (const page of ['0', '2', 'abc', '01', '-1']) {
      await expect(gamesSitemap(page)).rejects.toMatchObject({ status: 404 })
    }
  })

  it('lists the paginated games pages.', async () => {
    const xml = await (await pagesSitemapLoader()).text()

    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/games?page=1</loc>')
    expect(xml).not.toContain('/games?page=2')
  })
})
```

Run: `pnpm vitest run app/tests/integration/sitemaps.integration.spec.ts`
Expected: FAIL, because the new routes don't exist.

- [ ] **Step 4: Implement the three routes**

Replace `app/routes/sitemap[.]xml.tsx` with:

```tsx
import type { HeadersFunction } from 'react-router'

import { getCollection } from '~/db'
import {
  renderSitemapIndex,
  sitemapHeaders,
  sitemapPageCount
} from '~/sitemap/xml'

export const headers: HeadersFunction = () => sitemapHeaders

export const loader = async () => {
  const games = await getCollection('games')
  const pageCount = sitemapPageCount(await games.estimatedDocumentCount())

  const paths = [
    '/sitemap-tags.xml',
    '/sitemap-pages.xml',
    ...Array.from({ length: pageCount }, (_, index) => `/sitemap-games/${index + 1}`)
  ]

  return new Response(renderSitemapIndex(paths, new Date().toISOString()), {
    status: 200,
    headers: sitemapHeaders
  })
}
```

`app/routes/sitemap-pages[.]xml.tsx`:

```tsx
import type { HeadersFunction } from 'react-router'

import { GameService } from '~/services/game-service.server'
import { renderUrlSet, sitemapHeaders } from '~/sitemap/xml'

// Matches the page size of the /games listing.
const gamesPageSize = 48

export const headers: HeadersFunction = () => sitemapHeaders

export const loader = async () => {
  const gameCount = await new GameService().getGameCount()
  const pageCount = Math.ceil(gameCount / gamesPageSize)

  const entries = Array.from({ length: pageCount }, (_, index) => ({
    path: `/games?page=${index + 1}`,
    priority: '0.5'
  }))

  return new Response(renderUrlSet(entries, new Date().toISOString()), {
    status: 200,
    headers: sitemapHeaders
  })
}
```

`app/routes/sitemap-games.$page.tsx`:

```tsx
import type { HeadersFunction, LoaderFunctionArgs } from 'react-router'

import { getCollection } from '~/db'
import { gamesPerSitemap, renderUrlSet, sitemapHeaders } from '~/sitemap/xml'

export const headers: HeadersFunction = () => sitemapHeaders

function notFound(): Response {
  return new Response(null, { status: 404, statusText: 'Sitemap Not Found.' })
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const page = Number(params.page)

  // Only canonical page numbers: no zero, padding, signs or words.
  if (!Number.isInteger(page) || page < 1 || String(page) !== params.page) {
    throw notFound()
  }

  const collection = await getCollection('games')
  const games = (await collection
    .find({})
    .sort({ gameId: 1 })
    .skip((page - 1) * gamesPerSitemap)
    .limit(gamesPerSitemap)
    .project({ _id: 0, gameId: 1, slug: 1 })
    .toArray()) as { gameId: number; slug: string }[]

  if (games.length === 0 && page > 1) {
    throw notFound()
  }

  const entries = games.map(({ gameId, slug }) => ({
    path: `/app/${gameId}/${slug}`,
    priority: '1.0'
  }))

  return new Response(renderUrlSet(entries, new Date().toISOString()), {
    status: 200,
    headers: sitemapHeaders
  })
}
```

`GameService.getGameCount` caches its count at module level. The integration test file runs in its own worker, so the cache starts empty.

Run: `pnpm vitest run app/tests/integration/sitemaps.integration.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Gates, then commit**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all pass.

```bash
git add app/sitemap app/routes/sitemap[.]xml.tsx app/routes/sitemap-pages[.]xml.tsx app/routes/sitemap-games.\$page.tsx app/routes/sitemap-tags[.]xml.tsx app/tests/integration/sitemaps.integration.spec.ts
git commit -m "feat: split the sitemap into an index with 40k-game pages"
```

---

### Task 9: Local scrape script and documentation

**Files:**
- Create: `scripts/scrape-local.ts`
- Modify:
  - `package.json`: add the `scrape:local` script
  - `CONTRIBUTING.md`
  - `README.md`: only where it mentions the removed endpoints or `pnpm test`

**Interfaces:**
- Consumes:
  - `syncTags`, `listAppIds`, `scrapeIds`, `markDelisted`, `chunk`
  - `computeAndSaveStats`
  - `resetDatabaseConnection`

- [ ] **Step 1: Write `scripts/scrape-local.ts`**

```ts
// Runs the scrape steps in workflow order against a local MongoDB, without
// the workflow runtime. Calls the real Steam API, so it is opt-in.
//
//   DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity \
//   STEAM_API_KEY=… pnpm scrape:local [limit]
//
// limit caps how many app ids are scraped (default 2000, 0 = all). Delisting
// only runs for a full scrape, since a partial one would flag everything else.
import { resetDatabaseConnection } from '~/db'
import { computeAndSaveStats } from '~/market/compute-and-save-stats.server'
import { chunk } from '~/scrape/chunk'
import { listAppIds } from '~/scrape/list-app-ids'
import { markDelisted } from '~/scrape/mark-delisted'
import { scrapeIds } from '~/scrape/scrape-ids'
import { syncTags } from '~/scrape/sync-tags'

const url = process.env.DB_URL ?? ''
const databaseName = process.env.DB_DATABASE ?? ''
const apiKey = process.env.STEAM_API_KEY ?? ''
const limit = Number(process.argv[2] ?? '2000')

if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  console.error('Refusing to scrape: DB_URL must point at a local MongoDB.')
  process.exit(1)
}

if (!databaseName) {
  console.error('Refusing to scrape: DB_DATABASE must be set.')
  process.exit(1)
}

if (!apiKey) {
  console.error('STEAM_API_KEY must be set.')
  process.exit(1)
}

if (!Number.isInteger(limit) || limit < 0) {
  console.error('The limit must be a whole number, 0 for everything.')
  process.exit(1)
}

const runStartedAt = Date.now()

console.log(`Synced ${await syncTags()} tags.`)

const appIds = await listAppIds(apiKey, runStartedAt)
const selected = limit > 0 ? appIds.slice(0, limit) : appIds

console.log(`Steam lists ${appIds.length} games; scraping ${selected.length}.`)

for (const [index, appIdChunk] of chunk(selected, 1000).entries()) {
  const { saved, failedIds } = await scrapeIds(appIdChunk, runStartedAt)

  console.log(`Chunk ${index}: saved ${saved}, failed ${failedIds.length}.`)
}

if (limit === 0) {
  console.log('Delisting:', await markDelisted(runStartedAt, appIds.length))
}

console.log('Stats:', await computeAndSaveStats())

await resetDatabaseConnection()
```

In `package.json` `scripts`, add after `seed:local`:

```json
    "scrape:local": "tsx scripts/scrape-local.ts",
```

Run, without `STEAM_API_KEY`:

```bash
DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity pnpm scrape:local 10
```

Expected: `STEAM_API_KEY must be set.` and exit code 1. This proves the script loads and its guards run. Do not run it with a real key; the user runs it.

- [ ] **Step 2: Update `CONTRIBUTING.md`**

**Environment table:**
- `SCRAPE_KEY`: "Shared secret for starting the scrape workflow by hand (`POST /api/workflows/scrape` with an `x-scrape-key` header)".
- Add `CRON_SECRET`: "Secret Vercel Cron sends as `Authorization: Bearer …` when it starts the daily scrape | any long random string".
- `STEAM_API_KEY`: "Steam Web API key, needed by the scrape workflow".

**Endpoint bullets:** replace the three bullets for `/api/scrape-games`, `/api/compute-stats` and `/api/migrate-games` with:

```markdown
- The `scrapeGames` workflow (`workflows/scrape-games.ts`) refreshes the whole catalog. Vercel Cron starts it daily at 04:00 UTC through `GET /api/workflows/scrape`, and you can start it by hand with `curl -X POST -H "x-scrape-key: $SCRAPE_KEY" https://<host>/api/workflows/scrape`. It syncs tags, lists every game with `IStoreService/GetAppList`, scrapes them 1,000 at a time with `IStoreBrowseService/GetItems`, retries failed ids once, flags games Steam no longer lists (`delistedAt`, data kept), and recomputes tag stats. Watch the steps in the Vercel Workflows dashboard; each run's summary is stored in the `scrapeRuns` collection.
- `pnpm scrape:local [limit]` runs the same steps against your local MongoDB (see the comment at the top of `scripts/scrape-local.ts`).
```

**Testing section:** say that `pnpm test` runs both the unit tests (`pnpm test:unit`) and the workflow integration tests (`pnpm test:workflows`, which deletes `build/` first).

Make the matching edits in `README.md` wherever it mentions the removed endpoints or the test command.

- [ ] **Step 3: Gates, then commit**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all pass. Run the Grep tool for `scrape-games\?|compute-stats|migrate-games|health\.post` across `*.md`, `app`, `scripts` and `server`. Expected: no hits outside `docs/superpowers/`.

```bash
git add scripts/scrape-local.ts package.json CONTRIBUTING.md README.md
git commit -m "docs: document the scrape workflow and add a local scrape script"
```
