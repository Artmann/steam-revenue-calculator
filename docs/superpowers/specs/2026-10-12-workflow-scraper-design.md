# Workflow-based scraper design

Date: 2026-10-12
Status: approved in chat, pending spec review

## Goal

Replace the manual, cursor-driven `/api/scrape-games` and `/api/compute-stats`
endpoints with one durable Workflow SDK run that Vercel Cron starts every day.
The run refreshes the full Steam catalog, then recomputes the tag market
stats. Each step's status is visible in the Vercel Workflows dashboard, and a
summary record is written to Mongo. The rewrite also fixes the known scraper
defects listed in the backlog.

## Decisions

- **Refresh scope:** the full catalog, every day. That's about 150k games and
  roughly 750 `GetItems` calls. Review counts drive the revenue estimates and
  change without Steam marking the app as modified, so an incremental refresh
  would go stale.
- **Visibility:** the Vercel Workflows dashboard, plus a `scrapeRuns` document
  per run. No admin page.
- **Delisted games:** they are never deleted and never hidden. A game Steam no
  longer lists is no longer scraped, so its last data stays as it is. The
  `delistedAt` field records when it left Steam, and nothing on the site reads
  it.
- **In scope:**
  - the sitemap index
  - removal of the old endpoints
  - one retry pass for failed ids
  - delisted flagging
- **Not in scope:** an admin page, parallel chunk fetching, and incremental
  refresh.

## Architecture

### Trigger: `server/routes/api/workflows/scrape.ts`

- **Cron (`GET`):** `vercel.json` gains
  `crons: [{ path: '/api/workflows/scrape', schedule: '0 4 * * *' }]`. The
  request is authorised by `Authorization: Bearer <CRON_SECRET>`, which is
  Vercel's cron convention.
- **Manual (`POST`):** authorised by the `x-scrape-key: <SCRAPE_KEY>` header.
- **Secret checks:** both are constant-time, and a missing env var always
  returns 401.
- **Starting the run:**
  `start(scrapeGames, [{ trigger: 'cron' | 'manual' }])`. The route returns
  `{ runId }`.

### Workflow: `workflows/scrape-games.ts`

```
scrapeGames({ trigger })            'use workflow'
  claim hook token 'scrape-games'; on conflict return { skipped: true, activeRunId }
  runStartedAt = Date.now()         (deterministic inside the workflow)
  try
    startRun(runId, trigger, runStartedAt)
    syncTags()
    ids = listAppIds(runStartedAt)
    for each chunk of 1000 ids (index n):
      try scrapeChunk(runId, n, chunk, runStartedAt)
      catch → record chunk n as failed with all its ids (recordChunkFailure step)
    failed = collectFailedIds(runId)
    if failed.length: retryFailed(runId, failed, runStartedAt)   chunks of 1000, one pass
    markDelisted(runId, runStartedAt)
    computeStats(runId)
    finishRun(runId, 'succeeded')
  catch error
    finishRun(runId, 'failed', message)
    rethrow
```

**Steps** (each is `'use step'` and keeps the SDK default of 3 retries):

1. **`startRun`**
   - Upserts the `scrapeRuns` document `{ _id: runId, trigger, status: 'running', startedAt }`.
2. **`syncTags`**
   - Fetches `GetTagList`.
   - Existing tags keep their slug and get their name updated.
   - New tags get a slug that doesn't collide with any existing slug. The
     suffix is `-<tagId>`, as today.
   - Inserts use `$setOnInsert: { gameCount: 0 }`.
3. **`listAppIds(runStartedAt)`**
   - Pages through `GetAppList` with `include_games=true` and
     `max_results=50000` until `have_more_results` is false.
   - The next page starts after `last_appid`, falling back to the last app id
     on the page.
   - An empty page, or a page with no way to advance, ends the paging.
   - Removes ignored ids.
   - Sets `listedAt: runStartedAt` and unsets `delistedAt` for every listed id
     that already exists. This is done with `updateMany` over `$in` slices of
     10,000.
   - Records `listed` on the run and returns the ids.
4. **`scrapeChunk(runId, n, ids, runStartedAt)`**
   - Calls `GetItems` in batches of 200 and maps the items.
   - Bulk-upserts the mapped games, with `listedAt: runStartedAt` included in
     the upsert.
   - Writes `chunks.<n> = { saved, failedIds }` on the run. Writing by index
     means a retried step overwrites its result instead of adding to it.
   - A failed batch adds its ids to `failedIds` and does not throw.
5. **`recordChunkFailure(runId, n, ids)`**
   - Writes `chunks.<n> = { saved: 0, failedIds: ids }`.
6. **`collectFailedIds(runId)`**
   - Returns the union of all `chunks.*.failedIds`.
7. **`retryFailed(runId, ids, runStartedAt)`**
   - Runs the same fetch, map and upsert as `scrapeChunk` over the failed ids.
   - Records `retry = { attempted, saved, stillFailed }`.
   - Only one pass is made.
8. **`markDelisted(runId, runStartedAt)`**
   - Let `active` be the number of games without `delistedAt`, and `listed` the
     run's listed count.
   - If `listed < 0.9 * active`, it skips the step and records
     `delisted: { skipped: true, listed, active }`.
   - Otherwise it sets `delistedAt: runStartedAt` on games where
     `listedAt != runStartedAt` and `delistedAt` does not exist, and records
     the count.
9. **`computeStats(runId)`**
   - Runs the current `/api/compute-stats` logic, moved into
     `app/market/compute-and-save-stats.server.ts`, with unchanged output.
   - Records `stats = { games, tags, tagsWithStats }`.
10. **`finishRun(runId, status, error?)`**
    - Sets `status`, `finishedAt`, and `error` if there is one.

Chunks run one after another. About 150 chunks take around 25 minutes, and a
run has fewer than 170 steps, well inside the platform limits.

### Steam client: `app/steam/store-api.ts`

- **Timeouts:** every request uses `AbortSignal.timeout(30_000)`.
- **Rate limits:** a 429 throws `RetryableError` with `{ retryAfter: '1m' }`,
  which hands the wait to the workflow runtime.
- **Other non-OK responses:** they throw a normal `Error`, and the step
  retries apply. The error message still strips the query string, so the key
  never reaches the logs.
- **Removed:** the `deadline`, `now` and `sleep` options, along with the 45s
  budget logic.
- **Batch failures:** `fetchStoreItems` keeps reporting a failed batch in
  `failedIds` instead of throwing.

### Upserts: `app/steam/build-game-upsert.ts`

- **Stale fields:** optional fields the mapper reports as `undefined`
  (`releaseDate`, `releaseYear`, `percentPositive`) go into `$unset`, so a
  rescrape clears stale values. All other fields are always present.
- **New field:** `listedAt` is added to `$set`.

### Sitemap

- **`/sitemap.xml`:** becomes a `<sitemapindex>` that lists:
  - `/sitemap-pages.xml`, which holds the static pages and the
    `/games?page=N` URLs
  - `/sitemap-games/1` to `/sitemap-games/N`, with 40,000 games each
  - `/sitemap-tags.xml`, which stays unchanged
- **Contents:** delisted games stay in the sitemap.
- **Out-of-range pages:** a `/sitemap-games/N` past the last page returns 404.
- **Headers:** the content type and cache headers stay the same as today.

### Removals

- **Routes:**
  - `app/routes/api.scrape-games.ts`
  - `app/routes/api.compute-stats.ts`
  - `app/routes/api.migrate-games.ts`
  - their integration tests
- **Dead code:** `GameService.migrateGamesToDatabase`, plus any helpers only it
  used.
- **Health workflow:** `workflows/health.ts` and
  `server/routes/api/workflows/health.post.ts`. The scrape workflow replaces
  them.
- **Parity script:** drop the removed routes from its list.
- **Docs:** update `CONTRIBUTING.md` and `.env.template` (add `CRON_SECRET=`).

## Data

`scrapeRuns` document:

```ts
{
  _id: string            // workflow run id
  trigger: 'cron' | 'manual'
  status: 'running' | 'succeeded' | 'failed'
  startedAt: Date
  finishedAt?: Date
  listed?: number
  chunks?: Record<string, { saved: number; failedIds: number[] }>
  retry?: { attempted: number; saved: number; stillFailed: number[] }
  delisted?: { count: number } | { skipped: true; listed: number; active: number }
  stats?: { games: number; tags: number; tagsWithStats: number }
  error?: string
}
```

New `games` fields:
- `listedAt` (epoch ms, the run start)
- `delistedAt` (epoch ms)

New indexes:
- `games.listedAt`
- `scrapeRuns.startedAt` (descending)

## Error handling

| Failure | Behaviour |
|---|---|
| Steam 429 | `RetryableError` with a 1 minute wait; the step retries up to 3 times |
| Steam timeout or 5xx on a `GetItems` batch | That batch's ids are recorded as failed; the chunk continues |
| A whole chunk step fails 4 times | The workflow catches it, records the chunk as failed, and continues; the ids go into the retry pass |
| `syncTags`, `listAppIds`, `computeStats` or `markDelisted` fails 4 times | The run is marked `failed` with the message and the error is rethrown, so the run shows as failed in Vercel |
| `GetAppList` returns a truncated list | The delisting guard skips the flagging; nothing else is affected |
| A second run starts while one is active | The hook conflict returns `{ skipped }` before any step runs |

## Testing

- **Unit tests (Vitest):**
  - slug assignment against existing slugs
  - `GetAppList` paging, including an empty page and a missing `last_appid`
  - 429 → `RetryableError`
  - the timeout is passed to `fetch`
  - `$unset` of undefined optional fields
  - sitemap page splitting and the index XML
- **Workflow integration tests:** `@workflow/vitest` runs on the Local World,
  against mongodb-memory-server, with a fake Steam behind a stubbed `fetch`.
  The cases are:
  - Happy path over 3 chunks: games are upserted, tags synced, stats computed,
    and the run is `succeeded` with its counts.
  - One `GetItems` batch fails, then the retry pass saves it.
  - A whole chunk step keeps failing: the run still succeeds and the ids are
    recorded as `stillFailed`.
  - A game missing from the list gets `delistedAt`, and its data is otherwise
    unchanged.
  - A game that reappears has `delistedAt` cleared.
  - A truncated list skips the delisting.
  - A second concurrent start is skipped.
  - A rescrape unsets a `percentPositive` that has disappeared.
- **Trigger route tests:**
  - 401 without credentials, or with a wrong secret or key
  - starts a run for a valid cron bearer or a valid `x-scrape-key`
- **Local end-to-end:** `pnpm scrape:local` runs the workflow against Docker
  Mongo `src-parity`. It always sets `DB_URL` and `DB_DATABASE` inline, and is
  opt-in because it calls the real Steam API.

## Rollout

1. Add `CRON_SECRET` in Vercel. `STEAM_API_KEY` and `SCRAPE_KEY` must already
   be set for Production.
2. Merge, then trigger one manual run against production with `POST` and
   `x-scrape-key`, and watch it in the Workflows dashboard.
3. After that, the cron takes over daily at 04:00 UTC.
