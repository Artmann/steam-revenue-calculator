# Tag Market Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/tags` and `/tags/:slug` market pages: per-tag revenue stats that are precomputed daily, with live URL filters. They are backed by a scraper rewritten on Steam's batched store APIs.

**Architecture:**
- The scraper pages through `IStoreService/GetAppList` (cursor = `last_appid`) and enriches games in batches with `IStoreBrowseService/GetItems`.
- One pure function, `computeMarketStats`, does all the maths. It runs in a daily precompute job that writes per-tag stats to a `tags` collection and a Steam-wide baseline to `marketStats`. It also runs live for filtered views.
- Remix routes read the precomputed data and fall back to live computation when filters are set.

**Tech Stack:** Remix 1.19 (v2 route convention), React 18, Tailwind, MongoDB driver 3.6 (raw collections plus the esix `Game` model), Jest with ts-jest, and `slugify`.

**Spec:** `docs/superpowers/specs/2026-10-12-tag-market-pages-design.md`

### Deviations from the spec, found during planning (2026-10-12)

1. **`ISteamApps/GetAppList/v0002` now returns 404.** The current scraper is broken. Discovery moves to `IStoreService/GetAppList/v1`, which needs a Steam Web API key: new env var `STEAM_API_KEY`. That endpoint pages by `last_appid`, so the cursor becomes the last app ID, which also removes the old cursor bug.
2. **No separate `/api/backfill`.** The new scraper processes 1000 games per call, so one full pass (cursor 0 → 0) refreshes every game and fills the new fields.
3. **`details.price` and `details.numberOfReviews` are written as `basePrice` and `reviewCount`.** The existing game page recomputes revenue from those two fields, so it stays consistent with the stored `grossRevenue`. `details.metacritic`, `details.genres` and `details.categories` are not provided by `GetItems`. They are kept on existing documents and initialised empty on new ones.
4. **The sitemap sorts by `gameId` (indexed), not `details.name`.** Sorting ~100k documents on an unindexed field risks Mongo's in-memory sort limit.
5. **Filter UI:** a GET form without JS can't build `price=10-20` from two inputs. Price is a `<select>` with preset ranges that emit `price=10-20` etc. "Also tagged" is a `<select name="with">`. The parser accepts both comma-separated and repeated `with` params.

Verified facts (probe on 2026-10-12):
- `GetItems` returns up to 250 items per GET (500 fails with HTTP 400, URL length), so we use **200**.
- The undiscounted price is `best_purchase_option.original_price_in_cents`, which is present only when discounted.
- Free games have `is_free: true`.
- Screenshots come from `screenshots.all_ages_screenshots[].filename` with the prefix `https://shared.akamai.steamstatic.com/store_item_assets/`.

## Global Constraints

- Code style: no semicolons, single quotes, 2-space indent, named exports, `~/` import alias for `app/`.
- No new npm dependencies. No chart library: charts are hand-rolled HTML/CSS bars.
- MongoDB driver 3.6: no `$percentile`/`$median`; all statistics are computed in TypeScript.
- `MIN_GAMES_FOR_PAGE = 10`: a tag needs at least 10 games to get stats, a page and a sitemap entry.
- `MIN_GAMES_FOR_STATS = 5`: filtered views below 5 games hide percentiles, distribution, bands and trend.
- Cache-Control:
  - canonical tag pages and `/tags`: `public, max-age=300, s-maxage=86400, stale-while-revalidate=604800`
  - filtered views: `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`
- Canonical URL is always `https://steam-revenue-calculator.com/tags/{slug}`. Filtered views get `<meta name="robots" content="noindex, follow">`.
- Admin endpoints check `?key=` against `process.env.SCRAPE_KEY` and return 401 otherwise. The Steam key comes from `process.env.STEAM_API_KEY` and must never appear in responses or logs.
- Esix documents use a hex-string `_id`. Raw upserts must set `_id: new ObjectId().toHexString()` and `createdAt: Date.now()` on insert.
- Commit messages: conventional prefix (`feat:`, `fix:`, `docs:`, `test:`), **no `Co-Authored-By` lines**.
- Run single test files with `npx jest <path>`. Run the full suite with `npx jest` and typecheck with `npx tsc`.

## Review Focus

1. **Old documents without the new fields** (not yet rescraped): stats and filters must ignore them, and the game page must still render with no `tagIds`. Pinned in Task 5 (`toMarketGame` defaults) and Task 9 (game page without tags).
2. **Malformed filter params** (`price=abc`, `price=20-10`, `since=99`, `since=2024&until=2020`, empty strings from a blank form submit) should be ignored or swapped, never cause a 500, and must not mark the view as filtered when everything is empty. Pinned in Task 6.
3. **`with` naming the page's own tag, duplicates, mixed case, or unknown slugs**: own tag and duplicates are silently dropped, unknown slugs are reported. Pinned in Task 6.
4. **Tag names with punctuation or colliding slugs** ("Beat 'em up", "Design & Illustration", "Sci-fi" vs "Sci fi") should produce clean, unique slugs that stay stable across runs. Pinned in Task 3.
5. **Games with no release year or zero reviews** should count in totals and percentiles, but be excluded from the by-year trend only. Pinned in Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/steam/types.ts` | Types for Steam store API responses |
| `app/steam/map-store-item.ts` | Pure: `StoreItem` → `ScrapedGame` (price, tags, release, revenue) |
| `app/steam/build-game-upsert.ts` | Pure: `ScrapedGame` → Mongo `bulkWrite` upsert op |
| `app/steam/store-api.ts` | HTTP: `GetAppList`, `GetItems` (chunked, 429 retry), `GetTagList` |
| `app/market/constants.ts` | `MIN_GAMES_FOR_PAGE`, `MIN_GAMES_FOR_STATS`, cache headers |
| `app/market/tag-slugs.ts` | Pure: stable unique slugs for tags |
| `app/market/stats.ts` | Pure: `computeMarketStats`, `percentile`, `tagFrequencies`, types |
| `app/market/market-game.ts` | Pure: DB projection + `toMarketGame` |
| `app/market/compute-all.ts` | Pure: per-tag grouping → `computeAllTagStats` |
| `app/market/filters.ts` | Pure: parse URL filters, build Mongo query |
| `app/market/tag-summaries.ts` | Pure: `/tags` index sorting |
| `app/market/format.ts` | Pure: compact currency / percent formatting |
| `app/market/market-service.server.ts` | Mongo reads for market pages (tags, baseline, games) |
| `app/market/components/bar-list.tsx` | Horizontal bar chart rows |
| `app/market/components/filter-form.tsx` | GET filter form |
| `app/routes/api.scrape-games.ts` | Rewritten scraper endpoint |
| `app/routes/api.compute-stats.ts` | Precompute endpoint |
| `app/routes/tags.$slug.tsx` | Tag page |
| `app/routes/tags._index.tsx` | Tag index page |
| Modify `app/models/game.ts`, `app/db/index.ts`, `app/routes/app.$id.$slug.tsx`, `app/routes/sitemap[.]xml.tsx`, `app/components/page.tsx`, `.env.template`, `CONTRIBUTING.md`, `vercel.json` | |

---

### Task 1: Map Steam store items to games

**Files:**
- Create: `app/steam/types.ts`
- Create: `app/steam/map-store-item.ts`
- Test: `app/steam/map-store-item.spec.ts`

**Interfaces:**
- Consumes: `calculateRevenue(numberOfReviews: number, price: number): number` from `~/revenue`
- Produces:
  - `StoreItem`, `StoreTag`, `SteamTag` types (`app/steam/types.ts`)
  - `ScrapedGame` interface and `mapStoreItem(item: StoreItem): ScrapedGame | undefined` (`app/steam/map-store-item.ts`)

- [ ] **Step 1: Create the types**

`app/steam/types.ts`:

```ts
export interface StoreTag {
  tagid: number
  weight: number
}

export interface StoreItem {
  id: number
  appid?: number
  success: number
  name?: string
  is_free?: boolean
  tags?: StoreTag[]
  reviews?: {
    summary_filtered?: {
      review_count: number
      percent_positive: number
    }
  }
  release?: {
    steam_release_date?: number
    original_steam_release_date?: number
  }
  basic_info?: {
    short_description?: string
    developers?: { name: string }[]
    publishers?: { name: string }[]
  }
  best_purchase_option?: {
    final_price_in_cents: string
    original_price_in_cents?: string
  }
  screenshots?: {
    all_ages_screenshots?: { filename: string; ordinal: number }[]
  }
}

export interface SteamTag {
  tagid: number
  name: string
}
```

- [ ] **Step 2: Write the failing test**

`app/steam/map-store-item.spec.ts`:

```ts
import { calculateRevenue } from '~/revenue'
import { mapStoreItem } from '~/steam/map-store-item'
import type { StoreItem } from '~/steam/types'

const hades: StoreItem = {
  id: 1145360,
  appid: 1145360,
  success: 1,
  name: 'Hades',
  tags: [
    { tagid: 492, weight: 734 },
    { tagid: 42804, weight: 1051 },
    { tagid: 1646, weight: 750 }
  ],
  reviews: {
    summary_filtered: { review_count: 286667, percent_positive: 97 }
  },
  release: {
    steam_release_date: 1600353507,
    original_steam_release_date: 1575997560
  },
  basic_info: {
    short_description: 'Defy the god of the dead.',
    developers: [{ name: 'Supergiant Games' }],
    publishers: [{ name: 'Supergiant Games' }]
  },
  best_purchase_option: { final_price_in_cents: '2499' },
  screenshots: {
    all_ages_screenshots: [
      { filename: 'steam/apps/1145360/ss_b.jpg', ordinal: 2 },
      { filename: 'steam/apps/1145360/ss_a.jpg', ordinal: 1 }
    ]
  }
}

describe('mapStoreItem', () => {
  it('maps a full-price game.', () => {
    const game = mapStoreItem(hades)

    expect(game).toEqual({
      gameId: 1145360,
      name: 'Hades',
      description: 'Defy the god of the dead.',
      developers: ['Supergiant Games'],
      publishers: ['Supergiant Games'],
      screenshots: [
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/ss_a.jpg',
        'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/ss_b.jpg'
      ],
      tagIds: [42804, 1646, 492],
      releaseDate: new Date(1575997560 * 1000),
      releaseYear: 2019,
      reviewCount: 286667,
      percentPositive: 97,
      price: 2499,
      basePrice: 2499,
      grossRevenue: calculateRevenue(286667, 24.99)
    })
  })

  it('uses the undiscounted price for revenue when a game is on sale.', () => {
    const game = mapStoreItem({
      ...hades,
      best_purchase_option: {
        final_price_in_cents: '1999',
        original_price_in_cents: '3999'
      }
    })

    expect(game?.price).toBe(1999)
    expect(game?.basePrice).toBe(3999)
    expect(game?.grossRevenue).toBe(calculateRevenue(286667, 39.99))
  })

  it('keeps only the 20 heaviest tags.', () => {
    const tags = Array.from({ length: 25 }, (_, index) => ({
      tagid: index + 1,
      weight: index
    }))

    const game = mapStoreItem({ ...hades, tags })

    expect(game?.tagIds).toHaveLength(20)
    expect(game?.tagIds[0]).toBe(25)
    expect(game?.tagIds[19]).toBe(6)
  })

  it('falls back to steam_release_date and tolerates missing optional data.', () => {
    const game = mapStoreItem({
      id: 7,
      success: 1,
      name: 'Bare',
      release: { steam_release_date: 1600353507 },
      best_purchase_option: { final_price_in_cents: '999' }
    })

    expect(game).toMatchObject({
      gameId: 7,
      description: '',
      developers: [],
      publishers: [],
      screenshots: [],
      tagIds: [],
      releaseYear: 2020,
      reviewCount: 0,
      percentPositive: undefined
    })
  })

  it('leaves the release date undefined when Steam has none.', () => {
    const game = mapStoreItem({ ...hades, release: undefined })

    expect(game?.releaseDate).toBeUndefined()
    expect(game?.releaseYear).toBeUndefined()
  })

  it.each([
    ['free games', { ...hades, is_free: true }],
    ['failed lookups', { ...hades, success: 0 }],
    ['items without a name', { ...hades, name: undefined }],
    ['items with no purchase option', { ...hades, best_purchase_option: undefined }],
    ['zero prices', { ...hades, best_purchase_option: { final_price_in_cents: '0' } }]
  ])('skips %s.', (_, item) => {
    expect(mapStoreItem(item as StoreItem)).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest app/steam/map-store-item.spec.ts`
Expected: FAIL with "Cannot find module '~/steam/map-store-item'"

- [ ] **Step 4: Implement**

`app/steam/map-store-item.ts`:

```ts
import { calculateRevenue } from '~/revenue'
import type { StoreItem } from '~/steam/types'

export interface ScrapedGame {
  gameId: number
  name: string
  description: string
  developers: string[]
  publishers: string[]
  screenshots: string[]
  tagIds: number[]
  releaseDate?: Date
  releaseYear?: number
  reviewCount: number
  percentPositive?: number
  price: number
  basePrice: number
  grossRevenue: number
}

const maxTags = 20
const screenshotBaseUrl =
  'https://shared.akamai.steamstatic.com/store_item_assets/'

export function mapStoreItem(item: StoreItem): ScrapedGame | undefined {
  const purchaseOption = item.best_purchase_option

  if (item.success !== 1 || !item.name || item.is_free || !purchaseOption) {
    return
  }

  const price = parseInt(purchaseOption.final_price_in_cents, 10)
  const basePrice = parseInt(
    purchaseOption.original_price_in_cents ??
      purchaseOption.final_price_in_cents,
    10
  )

  if (!(price > 0) || !(basePrice > 0)) {
    return
  }

  const releaseSeconds =
    item.release?.original_steam_release_date ??
    item.release?.steam_release_date
  const releaseDate = releaseSeconds
    ? new Date(releaseSeconds * 1000)
    : undefined
  const reviewCount = item.reviews?.summary_filtered?.review_count ?? 0

  return {
    gameId: item.appid ?? item.id,
    name: item.name,
    description: item.basic_info?.short_description ?? '',
    developers: item.basic_info?.developers?.map(({ name }) => name) ?? [],
    publishers: item.basic_info?.publishers?.map(({ name }) => name) ?? [],
    screenshots: [...(item.screenshots?.all_ages_screenshots ?? [])]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map(({ filename }) => `${screenshotBaseUrl}${filename}`),
    tagIds: [...(item.tags ?? [])]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxTags)
      .map(({ tagid }) => tagid),
    releaseDate,
    releaseYear: releaseDate?.getUTCFullYear(),
    reviewCount,
    percentPositive: item.reviews?.summary_filtered?.percent_positive,
    price,
    basePrice,
    grossRevenue: calculateRevenue(reviewCount, basePrice / 100)
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest app/steam/map-store-item.spec.ts`
Expected: PASS (10 tests)

- [ ] **Step 6: Commit**

```bash
git add app/steam/types.ts app/steam/map-store-item.ts app/steam/map-store-item.spec.ts
git commit -m "feat: map Steam GetItems responses to games"
```

---

### Task 2: Game upserts, model fields and indexes

**Files:**
- Create: `app/steam/build-game-upsert.ts`
- Test: `app/steam/build-game-upsert.spec.ts`
- Modify: `app/models/game.ts`
- Modify: `app/db/index.ts` (`ensureIndexes`)

**Interfaces:**
- Consumes: `ScrapedGame` from `~/steam/map-store-item`; `createGameSlug(name: string): string` from `~/games`
- Produces: `buildGameUpsert(game: ScrapedGame, now: number, newId: string): GameUpsertOperation`

- [ ] **Step 1: Write the failing test**

`app/steam/build-game-upsert.spec.ts`:

```ts
import { buildGameUpsert } from '~/steam/build-game-upsert'
import type { ScrapedGame } from '~/steam/map-store-item'

const game: ScrapedGame = {
  gameId: 646570,
  name: 'Slay the Spire',
  description: 'Deckbuilder.',
  developers: ['Mega Crit'],
  publishers: ['Mega Crit'],
  screenshots: ['https://example.com/a.jpg'],
  tagIds: [1091588, 1666],
  releaseDate: new Date('2019-01-23T00:00:00Z'),
  releaseYear: 2019,
  reviewCount: 192403,
  percentPositive: 97,
  price: 1249,
  basePrice: 2499,
  grossRevenue: 1000
}

describe('buildGameUpsert', () => {
  it('upserts by gameId, setting top-level fields and the details the game page reads.', () => {
    const operation = buildGameUpsert(game, 1700000000000, 'abc123')

    expect(operation.updateOne.filter).toEqual({ gameId: 646570 })
    expect(operation.updateOne.upsert).toBe(true)
    expect(operation.updateOne.update.$set).toEqual({
      slug: 'slay-the-spire',
      grossRevenue: 1000,
      tagIds: [1091588, 1666],
      releaseDate: new Date('2019-01-23T00:00:00Z'),
      releaseYear: 2019,
      reviewCount: 192403,
      percentPositive: 97,
      price: 1249,
      basePrice: 2499,
      updatedAt: 1700000000000,
      'details.id': 646570,
      'details.name': 'Slay the Spire',
      'details.description': 'Deckbuilder.',
      'details.developers': ['Mega Crit'],
      'details.publishers': ['Mega Crit'],
      'details.screenshots': ['https://example.com/a.jpg'],
      'details.price': 2499,
      'details.numberOfReviews': 192403
    })
  })

  it('initialises esix and legacy detail fields only on insert.', () => {
    const operation = buildGameUpsert(game, 1700000000000, 'abc123')

    expect(operation.updateOne.update.$setOnInsert).toEqual({
      _id: 'abc123',
      createdAt: 1700000000000,
      'details.categories': [],
      'details.genres': [],
      'details.metacritic': {}
    })
  })

  it('omits undefined optional fields instead of writing nulls.', () => {
    const operation = buildGameUpsert(
      {
        ...game,
        releaseDate: undefined,
        releaseYear: undefined,
        percentPositive: undefined
      },
      1,
      'id'
    )

    const keys = Object.keys(operation.updateOne.update.$set)

    expect(keys).not.toContain('releaseDate')
    expect(keys).not.toContain('releaseYear')
    expect(keys).not.toContain('percentPositive')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/steam/build-game-upsert.spec.ts`
Expected: FAIL with "Cannot find module '~/steam/build-game-upsert'"

- [ ] **Step 3: Implement**

`app/steam/build-game-upsert.ts`:

```ts
import { createGameSlug } from '~/games'
import type { ScrapedGame } from '~/steam/map-store-item'

export interface GameUpsertOperation {
  updateOne: {
    filter: { gameId: number }
    update: {
      $set: Record<string, unknown>
      $setOnInsert: Record<string, unknown>
    }
    upsert: true
  }
}

export function buildGameUpsert(
  game: ScrapedGame,
  now: number,
  newId: string
): GameUpsertOperation {
  const fields: Record<string, unknown> = {
    slug: createGameSlug(game.name),
    grossRevenue: game.grossRevenue,
    tagIds: game.tagIds,
    releaseDate: game.releaseDate,
    releaseYear: game.releaseYear,
    reviewCount: game.reviewCount,
    percentPositive: game.percentPositive,
    price: game.price,
    basePrice: game.basePrice,
    updatedAt: now,
    'details.id': game.gameId,
    'details.name': game.name,
    'details.description': game.description,
    'details.developers': game.developers,
    'details.publishers': game.publishers,
    'details.screenshots': game.screenshots,
    // The game page recomputes revenue from these two, so they must match grossRevenue.
    'details.price': game.basePrice,
    'details.numberOfReviews': game.reviewCount
  }

  const $set = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  )

  return {
    updateOne: {
      filter: { gameId: game.gameId },
      update: {
        $set,
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
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/steam/build-game-upsert.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Add model fields**

Replace `app/models/game.ts` with:

```ts
import { BaseModel } from 'esix'
import type { GameDetails } from '~/games'

export class Game extends BaseModel {
  details?: GameDetails
  gameId = 0
  grossRevenue = 0
  slug = ''

  basePrice?: number
  percentPositive?: number
  price?: number
  releaseDate?: Date
  releaseYear?: number
  reviewCount?: number
  tagIds?: number[]
}
```

- [ ] **Step 6: Update indexes**

In `app/db/index.ts`, replace the body of `ensureIndexes` after `const db = mongoClient.db(databaseName)` with:

```ts
  const games = db.collection('games')
  const tags = db.collection('tags')

  // The name lives at details.name, so this index never did anything.
  await games.dropIndex('name_1').catch(() => {})

  await Promise.all([
    games.createIndex({ grossRevenue: -1 }, { background: true }),
    games.createIndex({ gameId: 1 }, { background: true, unique: true }),
    games.createIndex({ tagIds: 1 }, { background: true }),
    games.createIndex({ releaseYear: 1 }, { background: true }),
    games.createIndex({ basePrice: 1 }, { background: true }),
    tags.createIndex({ tagId: 1 }, { background: true, unique: true }),
    tags.createIndex({ slug: 1 }, { background: true, unique: true })
  ])
```

- [ ] **Step 7: Typecheck and run the full suite**

Run: `npx tsc && npx jest`
Expected: no type errors; all tests PASS

- [ ] **Step 8: Commit**

```bash
git add app/steam/build-game-upsert.ts app/steam/build-game-upsert.spec.ts app/models/game.ts app/db/index.ts
git commit -m "feat: game upserts with tags, release date and base price"
```

---

### Task 3: Steam store API client, tag slugs and scraper rewrite

**Files:**
- Create: `app/steam/store-api.ts`
- Create: `app/market/constants.ts`
- Create: `app/market/tag-slugs.ts`
- Test: `app/market/tag-slugs.spec.ts`
- Rewrite: `app/routes/api.scrape-games.ts`
- Modify: `.env.template`, `CONTRIBUTING.md` ("Data pipeline" section)

**Interfaces:**
- Consumes: `StoreItem`, `SteamTag` (Task 1); `mapStoreItem` (Task 1); `buildGameUpsert` (Task 2); `getCollection(name)` from `~/db`
- Produces:
  - `fetchAppIdPage(apiKey: string, lastAppId: number, maxResults: number): Promise<AppIdPage>`
  - `fetchStoreItems(appIds: number[]): Promise<StoreItem[]>`
  - `fetchTagList(): Promise<SteamTag[]>`
  - `createTagSlugs(tags: SteamTag[]): TagSlug[]` where `TagSlug = { tagId: number; name: string; slug: string }`
  - constants `MIN_GAMES_FOR_PAGE = 10`, `MIN_GAMES_FOR_STATS = 5`, `CANONICAL_CACHE_CONTROL`, `FILTERED_CACHE_CONTROL`, `SITE_URL`

- [ ] **Step 1: Write the failing slug test**

`app/market/tag-slugs.spec.ts`:

```ts
import { createTagSlugs } from '~/market/tag-slugs'

describe('createTagSlugs', () => {
  it('produces lowercase, punctuation-free slugs.', () => {
    const slugs = createTagSlugs([
      { tagid: 1, name: 'Rogue-like' },
      { tagid: 2, name: "Beat 'em up" },
      { tagid: 3, name: 'Design & Illustration' },
      { tagid: 4, name: '4X' }
    ])

    expect(slugs.map(({ slug }) => slug)).toEqual([
      'rogue-like',
      'beat-em-up',
      'design-and-illustration',
      '4x'
    ])
  })

  it('suffixes the tag id on collisions, keeping the lowest id unsuffixed regardless of input order.', () => {
    const slugs = createTagSlugs([
      { tagid: 9999, name: 'Sci fi' },
      { tagid: 3942, name: 'Sci-fi' }
    ])

    expect(slugs).toEqual([
      { tagId: 3942, name: 'Sci-fi', slug: 'sci-fi' },
      { tagId: 9999, name: 'Sci fi', slug: 'sci-fi-9999' }
    ])
  })

  it('falls back to the tag id when the name has no sluggable characters.', () => {
    expect(createTagSlugs([{ tagid: 5, name: '♥' }])[0].slug).toBe('tag-5')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/market/tag-slugs.spec.ts`
Expected: FAIL with "Cannot find module '~/market/tag-slugs'"

- [ ] **Step 3: Implement the slugs and constants**

`app/market/tag-slugs.ts`:

```ts
import slugify from 'slugify'

import type { SteamTag } from '~/steam/types'

export interface TagSlug {
  tagId: number
  name: string
  slug: string
}

export function createTagSlugs(tags: SteamTag[]): TagSlug[] {
  const taken = new Set<string>()

  return [...tags]
    .sort((a, b) => a.tagid - b.tagid)
    .map(({ tagid, name }) => {
      const base = slugify(name, { lower: true, strict: true }) || `tag-${tagid}`
      const slug = taken.has(base) ? `${base}-${tagid}` : base

      taken.add(slug)

      return { tagId: tagid, name, slug }
    })
}
```

`app/market/constants.ts`:

```ts
export const MIN_GAMES_FOR_PAGE = 10
export const MIN_GAMES_FOR_STATS = 5

export const SITE_URL = 'https://steam-revenue-calculator.com'

export const CANONICAL_CACHE_CONTROL =
  'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800'
export const FILTERED_CACHE_CONTROL =
  'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/market/tag-slugs.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the store API client**

`app/steam/store-api.ts`:

```ts
import type { SteamTag, StoreItem } from '~/steam/types'

export interface AppIdPage {
  appIds: number[]
  lastAppId: number
  haveMoreResults: boolean
}

// GetItems accepts ~250 ids before the GET URL gets too long; stay below it.
const storeItemsBatchSize = 200
const maxAttempts = 3
const rateLimitDelayMs = 30_000

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
    lastAppId: data.response.last_appid ?? apps[apps.length - 1]?.appid ?? 0,
    haveMoreResults: Boolean(data.response.have_more_results)
  }
}

export async function fetchStoreItems(appIds: number[]): Promise<StoreItem[]> {
  const items: StoreItem[] = []

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

    const data = await getJson<{ response: { store_items?: StoreItem[] } }>(
      `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(
        JSON.stringify(input)
      )}`
    )

    items.push(...(data.response.store_items ?? []))
  }

  return items
}

export async function fetchTagList(): Promise<SteamTag[]> {
  const data = await getJson<{ response: { tags?: SteamTag[] } }>(
    'https://api.steampowered.com/IStoreService/GetTagList/v1/?language=english'
  )

  return data.response.tags ?? []
}

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  const response = await fetch(url)

  if (response.status === 429 && attempt < maxAttempts) {
    console.log('Rate limited by Steam. Waiting 30 seconds...')

    await new Promise((resolve) => setTimeout(resolve, rateLimitDelayMs))

    return getJson(url, attempt + 1)
  }

  if (!response.ok) {
    // Strip the query string so the API key never reaches the logs.
    throw new Error(
      `Steam request failed with ${response.status}: ${url.split('?')[0]}`
    )
  }

  return (await response.json()) as T
}
```

- [ ] **Step 6: Rewrite the scraper route**

Replace `app/routes/api.scrape-games.ts` with:

```ts
import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
//@ts-ignore
import { ObjectId } from 'mongodb'

import fs from 'fs'

import { getCollection } from '~/db'
import { createTagSlugs } from '~/market/tag-slugs'
import { buildGameUpsert } from '~/steam/build-game-upsert'
import { mapStoreItem, type ScrapedGame } from '~/steam/map-store-item'
import {
  fetchAppIdPage,
  fetchStoreItems,
  fetchTagList
} from '~/steam/store-api'
import type { StoreItem } from '~/steam/types'

const pageSize = 1000

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  const cursor = parseInt(url.searchParams.get('cursor') ?? '0', 10) || 0
  const expectedKey = process.env.SCRAPE_KEY
  const apiKey = process.env.STEAM_API_KEY

  if (!expectedKey || !key || key !== expectedKey) {
    return new Response('Unauthorized.', { status: 401 })
  }

  if (!apiKey) {
    return new Response('STEAM_API_KEY is not configured.', { status: 500 })
  }

  if (cursor === 0) {
    await syncTags()
  }

  const ignoredIds = new Set(await loadIgnoredIds())
  const page = await fetchAppIdPage(apiKey, cursor, pageSize)
  const appIds = page.appIds.filter((appId) => !ignoredIds.has(appId))

  let items: StoreItem[] = []

  try {
    items = await fetchStoreItems(appIds)
  } catch (error) {
    // Skip this page rather than stall the whole run on one bad batch.
    console.error(`Failed to fetch store items after app id ${cursor}.`)
    console.error(error)
  }

  const games = items
    .map(mapStoreItem)
    .filter((game): game is ScrapedGame => Boolean(game))

  if (games.length > 0) {
    const collection = await getCollection('games')
    const now = Date.now()

    await collection.bulkWrite(
      games.map((game) =>
        buildGameUpsert(game, now, new ObjectId().toHexString())
      ),
      { ordered: false }
    )
  }

  return json({
    cursor,
    nextCursor: page.haveMoreResults ? page.lastAppId : 0,
    fetched: appIds.length,
    saved: games.length
  })
}

async function syncTags(): Promise<void> {
  const tags = createTagSlugs(await fetchTagList())

  if (tags.length === 0) {
    return
  }

  const collection = await getCollection('tags')

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
}

async function loadIgnoredIds(): Promise<number[]> {
  try {
    const data = await fs.promises.readFile('./data/ignored.json', 'utf-8')

    return JSON.parse(data) ?? []
  } catch (error) {
    console.error(error)
  }

  return []
}
```

- [ ] **Step 7: Update env template and docs**

Append to `.env.template`:

```
STEAM_API_KEY=
```

In `CONTRIBUTING.md`, replace the `GET /api/scrape-games…` bullet with:

```markdown
- `GET /api/scrape-games?key=…&cursor=N` — pages through Steam's game list (`IStoreService/GetAppList`, needs `STEAM_API_KEY`) 1000 games at a time and upserts them using `IStoreBrowseService/GetItems`. Start with `cursor=0` (which also syncs the tag list) and call again with the returned `nextCursor` until it is `0`.
- `GET /api/compute-stats?key=…` — recomputes per-tag market stats. Run it after a full scrape pass.
```

- [ ] **Step 8: Manual check against the real API**

With `STEAM_API_KEY` set in `.env` and a local Mongo running, run `npm run dev` and open `http://localhost:3000/api/scrape-games?key=<SCRAPE_KEY>&cursor=0`.
Expected: JSON like `{ "cursor": 0, "nextCursor": <appid>, "fetched": 1000, "saved": <n> }` with `saved > 0`, and a populated `tags` collection.

If `GetAppList` uses a different response shape than `response.apps / have_more_results / last_appid`, fix `fetchAppIdPage` to match it before committing.

- [ ] **Step 9: Typecheck and run the full suite**

Run: `npx tsc && npx jest`
Expected: no type errors; all tests PASS

- [ ] **Step 10: Commit**

```bash
git add app/steam/store-api.ts app/market/constants.ts app/market/tag-slugs.ts app/market/tag-slugs.spec.ts app/routes/api.scrape-games.ts .env.template CONTRIBUTING.md
git commit -m "feat: scrape games with Steam's batched store APIs"
```

---

### Task 4: Market stats computation

**Files:**
- Create: `app/market/stats.ts`
- Test: `app/market/stats.spec.ts`

**Interfaces:**
- Produces (all from `~/market/stats`):
  - types `MarketGame`, `MarketStats`, `TagFrequencies`, `TopGame`, `TopCompany`, `RelatedTag`, `CountBucket`, `MedianBucket`, `YearPoint`
  - `percentile(sorted: number[], q: number): number`
  - `tagFrequencies(games: MarketGame[]): TagFrequencies`
  - `computeMarketStats(games: MarketGame[], baseline?: TagFrequencies, excludeTagIds?: number[]): MarketStats`

- [ ] **Step 1: Write the failing test**

`app/market/stats.spec.ts`:

```ts
import {
  computeMarketStats,
  percentile,
  tagFrequencies,
  type MarketGame
} from '~/market/stats'

let nextId = 1

function game(overrides: Partial<MarketGame> = {}): MarketGame {
  const gameId = overrides.gameId ?? nextId++

  return {
    gameId,
    name: `Game ${gameId}`,
    slug: `game-${gameId}`,
    grossRevenue: 0,
    basePrice: 999,
    releaseYear: 2020,
    tagIds: [],
    reviewCount: 0,
    developers: [],
    publishers: [],
    ...overrides
  }
}

describe('percentile', () => {
  it('returns 0 for an empty list.', () => {
    expect(percentile([], 0.5)).toBe(0)
  })

  it('returns the only value for a single-element list.', () => {
    expect(percentile([5], 0.1)).toBe(5)
    expect(percentile([5], 0.9)).toBe(5)
  })

  it('interpolates linearly between ranks.', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(percentile([10, 20, 30, 40, 50], 0.1)).toBeCloseTo(14)
    expect(percentile([10, 20, 30, 40, 50], 0.9)).toBeCloseTo(46)
  })
})

describe('tagFrequencies', () => {
  it('returns the share of games carrying each tag, counting a tag once per game.', () => {
    const games = [
      game({ tagIds: [1, 2, 2] }),
      game({ tagIds: [1] }),
      game({ tagIds: [1] }),
      game({ tagIds: [1] })
    ]

    expect(tagFrequencies(games)).toEqual({ 1: 1, 2: 0.25 })
  })
})

describe('computeMarketStats', () => {
  const ladder = [
    game({ grossRevenue: 500, basePrice: 499, releaseYear: 2020 }),
    game({ grossRevenue: 5_000, basePrice: 999, releaseYear: 2020 }),
    game({ grossRevenue: 50_000, basePrice: 1499, releaseYear: 2021 }),
    game({ grossRevenue: 500_000, basePrice: 1999, releaseYear: undefined }),
    game({ grossRevenue: 5_000_000, basePrice: 2999, releaseYear: 2022 })
  ]

  it('computes totals and percentiles.', () => {
    const stats = computeMarketStats(ladder)

    expect(stats.gameCount).toBe(5)
    expect(stats.totalRevenue).toBe(5_555_500)
    expect(stats.meanRevenue).toBe(1_111_100)
    expect(stats.percentiles.p10).toBeCloseTo(2_300)
    expect(stats.percentiles.p25).toBe(5_000)
    expect(stats.percentiles.p50).toBe(50_000)
    expect(stats.percentiles.p75).toBe(500_000)
    expect(stats.percentiles.p90).toBeCloseTo(3_200_000)
  })

  it('computes the share of games at or above each threshold.', () => {
    expect(computeMarketStats(ladder).shareAbove).toEqual({
      thousand: 0.8,
      tenThousand: 0.6,
      hundredThousand: 0.4,
      million: 0.2
    })
  })

  it('buckets revenue on a log scale, with each edge belonging to the upper bucket.', () => {
    const stats = computeMarketStats([
      ...ladder,
      game({ grossRevenue: 1_000 }),
      game({ grossRevenue: 10_000_000 })
    ])

    expect(stats.distribution).toEqual([
      { label: 'Under $1K', count: 1 },
      { label: '$1K–10K', count: 2 },
      { label: '$10K–100K', count: 1 },
      { label: '$100K–1M', count: 1 },
      { label: '$1M–10M', count: 1 },
      { label: '$10M+', count: 1 }
    ])
  })

  it('groups by base price band with medians, each edge belonging to the upper band.', () => {
    const stats = computeMarketStats([...ladder, game({ grossRevenue: 7, basePrice: 500 })])

    expect(stats.priceBands).toEqual([
      { label: 'Under $5', count: 1, median: 500 },
      { label: '$5–10', count: 2, median: 2_503.5 },
      { label: '$10–15', count: 1, median: 50_000 },
      { label: '$15–20', count: 1, median: 500_000 },
      { label: '$20–30', count: 1, median: 5_000_000 },
      { label: '$30+', count: 0, median: 0 }
    ])
  })

  it('trends by release year ascending, skipping games without a year.', () => {
    expect(computeMarketStats(ladder).byYear).toEqual([
      { year: 2020, count: 2, median: 2_750 },
      { year: 2021, count: 1, median: 50_000 },
      { year: 2022, count: 1, median: 5_000_000 }
    ])
  })

  it('keeps games without a year or reviews in the totals.', () => {
    const stats = computeMarketStats([
      game({ grossRevenue: 0, reviewCount: 0, releaseYear: undefined }),
      game({ grossRevenue: 100 })
    ])

    expect(stats.gameCount).toBe(2)
    expect(stats.percentiles.p50).toBe(50)
    expect(stats.byYear).toEqual([{ year: 2020, count: 1, median: 100 }])
  })

  it('lists the top 25 games by revenue, breaking ties by lower game id.', () => {
    const games = Array.from({ length: 30 }, (_, index) =>
      game({ gameId: 1000 + index, grossRevenue: index })
    )
    games.push(game({ gameId: 999, grossRevenue: 29 }))

    const { topGames } = computeMarketStats(games)

    expect(topGames).toHaveLength(25)
    expect(topGames[0]).toEqual({
      gameId: 999,
      name: 'Game 999',
      slug: 'game-999',
      grossRevenue: 29
    })
    expect(topGames[1].gameId).toBe(1029)
  })

  it('sums revenue per developer and publisher, counting a name once per game.', () => {
    const stats = computeMarketStats([
      game({ grossRevenue: 100, developers: ['A', 'A'], publishers: ['P'] }),
      game({ grossRevenue: 50, developers: ['A', 'B'], publishers: ['P'] }),
      game({ grossRevenue: 500, developers: ['C'], publishers: ['Q'] })
    ])

    expect(stats.topDevelopers).toEqual([
      { name: 'C', gameCount: 1, revenue: 500 },
      { name: 'A', gameCount: 2, revenue: 150 },
      { name: 'B', gameCount: 1, revenue: 50 }
    ])
    expect(stats.topPublishers).toEqual([
      { name: 'Q', gameCount: 1, revenue: 500 },
      { name: 'P', gameCount: 2, revenue: 150 }
    ])
  })

  describe('related tags', () => {
    // 10 games, all tagged 1 (the page's own tag).
    // Tag 2: in 8 of them, 10% of Steam → lift 8, included.
    // Tag 3: in all 10, 100% of Steam → lift 1, a generic tag, excluded.
    // Tag 4: in 4, 1% of Steam → high lift but under 5 games, excluded.
    const games = Array.from({ length: 10 }, (_, index) =>
      game({
        tagIds: [1, 3, ...(index < 8 ? [2] : []), ...(index < 4 ? [4] : [])]
      })
    )
    const baseline = { 1: 0.05, 2: 0.1, 3: 1, 4: 0.01 }

    it('keeps tags over-represented relative to Steam with at least 5 games.', () => {
      const { relatedTags } = computeMarketStats(games, baseline, [1])

      expect(relatedTags).toHaveLength(1)
      expect(relatedTags[0].tagId).toBe(2)
      expect(relatedTags[0].count).toBe(8)
      expect(relatedTags[0].lift).toBeCloseTo(8)
    })

    it('returns no related tags without a baseline.', () => {
      expect(computeMarketStats(games).relatedTags).toEqual([])
    })
  })

  it('returns zeroed stats for an empty set.', () => {
    const stats = computeMarketStats([])

    expect(stats.gameCount).toBe(0)
    expect(stats.meanRevenue).toBe(0)
    expect(stats.percentiles.p50).toBe(0)
    expect(stats.shareAbove.thousand).toBe(0)
    expect(stats.topGames).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/market/stats.spec.ts`
Expected: FAIL with "Cannot find module '~/market/stats'"

- [ ] **Step 3: Implement**

`app/market/stats.ts`:

```ts
export interface MarketGame {
  gameId: number
  name: string
  slug: string
  grossRevenue: number
  basePrice: number
  releaseYear?: number
  tagIds: number[]
  reviewCount: number
  developers: string[]
  publishers: string[]
}

export type TagFrequencies = Record<number, number>

export interface CountBucket {
  label: string
  count: number
}

export interface MedianBucket {
  label: string
  count: number
  median: number
}

export interface YearPoint {
  year: number
  count: number
  median: number
}

export interface TopGame {
  gameId: number
  name: string
  slug: string
  grossRevenue: number
}

export interface TopCompany {
  name: string
  gameCount: number
  revenue: number
}

export interface RelatedTag {
  tagId: number
  count: number
  lift: number
}

export interface MarketStats {
  gameCount: number
  totalRevenue: number
  meanRevenue: number
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number }
  shareAbove: {
    thousand: number
    tenThousand: number
    hundredThousand: number
    million: number
  }
  distribution: CountBucket[]
  priceBands: MedianBucket[]
  byYear: YearPoint[]
  topGames: TopGame[]
  topDevelopers: TopCompany[]
  topPublishers: TopCompany[]
  relatedTags: RelatedTag[]
}

const revenueEdges = [1_000, 10_000, 100_000, 1_000_000, 10_000_000]
const revenueLabels = [
  'Under $1K',
  '$1K–10K',
  '$10K–100K',
  '$100K–1M',
  '$1M–10M',
  '$10M+'
]

// Base price in cents.
const priceEdges = [500, 1000, 1500, 2000, 3000]
const priceLabels = [
  'Under $5',
  '$5–10',
  '$10–15',
  '$15–20',
  '$20–30',
  '$30+'
]

const topGameCount = 25
const topCompanyCount = 10
const relatedTagCount = 12
const minRelatedTagGames = 5

export function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) {
    return 0
  }

  const index = (sorted.length - 1) * q
  const lower = Math.floor(index)
  const upper = Math.ceil(index)

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

export function tagFrequencies(games: MarketGame[]): TagFrequencies {
  const frequencies: TagFrequencies = {}

  for (const [tagId, count] of countTags(games)) {
    frequencies[tagId] = count / games.length
  }

  return frequencies
}

export function computeMarketStats(
  games: MarketGame[],
  baseline?: TagFrequencies,
  excludeTagIds: number[] = []
): MarketStats {
  const revenues = sortNumbers(games.map(({ grossRevenue }) => grossRevenue))
  const totalRevenue = revenues.reduce((sum, value) => sum + value, 0)
  const shareAtLeast = (threshold: number) =>
    games.length === 0
      ? 0
      : revenues.filter((value) => value >= threshold).length / games.length

  const distribution = revenueLabels.map((label) => ({ label, count: 0 }))

  for (const revenue of revenues) {
    distribution[bucketIndex(revenue, revenueEdges)].count += 1
  }

  const bandRevenues: number[][] = priceLabels.map(() => [])

  for (const game of games) {
    bandRevenues[bucketIndex(game.basePrice, priceEdges)].push(game.grossRevenue)
  }

  const yearRevenues = new Map<number, number[]>()

  for (const game of games) {
    if (!game.releaseYear) {
      continue
    }

    const values = yearRevenues.get(game.releaseYear)

    if (values) {
      values.push(game.grossRevenue)
    } else {
      yearRevenues.set(game.releaseYear, [game.grossRevenue])
    }
  }

  return {
    gameCount: games.length,
    totalRevenue,
    meanRevenue: games.length === 0 ? 0 : totalRevenue / games.length,
    percentiles: {
      p10: percentile(revenues, 0.1),
      p25: percentile(revenues, 0.25),
      p50: percentile(revenues, 0.5),
      p75: percentile(revenues, 0.75),
      p90: percentile(revenues, 0.9)
    },
    shareAbove: {
      thousand: shareAtLeast(1_000),
      tenThousand: shareAtLeast(10_000),
      hundredThousand: shareAtLeast(100_000),
      million: shareAtLeast(1_000_000)
    },
    distribution,
    priceBands: priceLabels.map((label, index) => ({
      label,
      count: bandRevenues[index].length,
      median: median(bandRevenues[index])
    })),
    byYear: [...yearRevenues]
      .sort(([a], [b]) => a - b)
      .map(([year, values]) => ({
        year,
        count: values.length,
        median: median(values)
      })),
    topGames: [...games]
      .sort((a, b) => b.grossRevenue - a.grossRevenue || a.gameId - b.gameId)
      .slice(0, topGameCount)
      .map(({ gameId, name, slug, grossRevenue }) => ({
        gameId,
        name,
        slug,
        grossRevenue
      })),
    topDevelopers: topCompanies(games, 'developers'),
    topPublishers: topCompanies(games, 'publishers'),
    relatedTags: relatedTags(games, baseline, excludeTagIds)
  }
}

function sortNumbers(values: number[]): number[] {
  return [...values].sort((a, b) => a - b)
}

function median(values: number[]): number {
  return percentile(sortNumbers(values), 0.5)
}

function bucketIndex(value: number, edges: number[]): number {
  return edges.filter((edge) => value >= edge).length
}

function countTags(games: MarketGame[]): Map<number, number> {
  const counts = new Map<number, number>()

  for (const game of games) {
    for (const tagId of new Set(game.tagIds)) {
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
    }
  }

  return counts
}

function topCompanies(
  games: MarketGame[],
  key: 'developers' | 'publishers'
): TopCompany[] {
  const totals = new Map<string, TopCompany>()

  for (const game of games) {
    for (const name of new Set(game[key])) {
      const entry = totals.get(name) ?? { name, gameCount: 0, revenue: 0 }

      entry.gameCount += 1
      entry.revenue += game.grossRevenue
      totals.set(name, entry)
    }
  }

  return [...totals.values()]
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name))
    .slice(0, topCompanyCount)
}

function relatedTags(
  games: MarketGame[],
  baseline: TagFrequencies | undefined,
  excludeTagIds: number[]
): RelatedTag[] {
  if (!baseline || games.length === 0) {
    return []
  }

  const excluded = new Set(excludeTagIds)
  const score = ({ count, lift }: RelatedTag) => count * Math.log(lift)

  return [...countTags(games)]
    .filter(
      ([tagId, count]) =>
        !excluded.has(tagId) &&
        count >= minRelatedTagGames &&
        (baseline[tagId] ?? 0) > 0
    )
    .map(([tagId, count]) => ({
      tagId,
      count,
      lift: count / games.length / baseline[tagId]
    }))
    .filter(({ lift }) => lift > 1)
    .sort((a, b) => score(b) - score(a) || a.tagId - b.tagId)
    .slice(0, relatedTagCount)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/market/stats.spec.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add app/market/stats.ts app/market/stats.spec.ts
git commit -m "feat: compute market stats for a set of games"
```

---

### Task 5: Precompute per-tag stats

**Files:**
- Create: `app/market/market-game.ts`
- Create: `app/market/compute-all.ts`
- Create: `app/market/market-service.server.ts`
- Create: `app/routes/api.compute-stats.ts`
- Test: `app/market/market-game.spec.ts`, `app/market/compute-all.spec.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `MarketGame`, `MarketStats`, `TagFrequencies`, `computeMarketStats`, `tagFrequencies` (Task 4); `MIN_GAMES_FOR_PAGE` (Task 3)
- Produces:
  - `MARKET_GAME_PROJECTION`, `MarketGameDocument`, `toMarketGame(doc: MarketGameDocument): MarketGame` (`~/market/market-game`)
  - `computeAllTagStats(games: MarketGame[]): AllTagStats` where `AllTagStats = { baseline: { stats: MarketStats; tagFrequencies: TagFrequencies }; tags: TagStatsResult[] }` and `TagStatsResult = { tagId: number; gameCount: number; stats?: MarketStats }` (`~/market/compute-all`)
  - `loadMarketGames(query: Record<string, unknown>): Promise<MarketGame[]>` (`~/market/market-service.server`; Task 7 adds more functions to this file)

- [ ] **Step 1: Write the failing tests**

`app/market/market-game.spec.ts`:

```ts
import { toMarketGame } from '~/market/market-game'

describe('toMarketGame', () => {
  it('flattens the stored document.', () => {
    expect(
      toMarketGame({
        gameId: 1,
        slug: 'hades',
        grossRevenue: 100,
        basePrice: 2499,
        releaseYear: 2019,
        tagIds: [1, 2],
        reviewCount: 10,
        details: {
          name: 'Hades',
          developers: ['Supergiant Games'],
          publishers: ['Supergiant Games']
        }
      })
    ).toEqual({
      gameId: 1,
      name: 'Hades',
      slug: 'hades',
      grossRevenue: 100,
      basePrice: 2499,
      releaseYear: 2019,
      tagIds: [1, 2],
      reviewCount: 10,
      developers: ['Supergiant Games'],
      publishers: ['Supergiant Games']
    })
  })

  it('defaults fields missing on documents scraped before tags existed.', () => {
    expect(
      toMarketGame({ gameId: 2, slug: 'old', grossRevenue: 5 })
    ).toEqual({
      gameId: 2,
      name: '',
      slug: 'old',
      grossRevenue: 5,
      basePrice: 0,
      releaseYear: undefined,
      tagIds: [],
      reviewCount: 0,
      developers: [],
      publishers: []
    })
  })
})
```

`app/market/compute-all.spec.ts`:

```ts
import { computeAllTagStats } from '~/market/compute-all'
import type { MarketGame } from '~/market/stats'

function game(gameId: number, tagIds: number[]): MarketGame {
  return {
    gameId,
    name: `Game ${gameId}`,
    slug: `game-${gameId}`,
    grossRevenue: gameId * 1000,
    basePrice: 999,
    releaseYear: 2020,
    tagIds,
    reviewCount: 10,
    developers: [],
    publishers: []
  }
}

describe('computeAllTagStats', () => {
  // Tag 1: 10 games (gets stats). Tag 2: 9 games (no stats). Tag 3: 6 of tag 1's games.
  const games = [
    ...Array.from({ length: 10 }, (_, index) =>
      game(index + 1, index < 6 ? [1, 3, 1] : [1])
    ),
    ...Array.from({ length: 9 }, (_, index) => game(100 + index, [2]))
  ]

  const result = computeAllTagStats(games)

  it('computes a baseline across all games.', () => {
    expect(result.baseline.stats.gameCount).toBe(19)
    expect(result.baseline.tagFrequencies[1]).toBeCloseTo(10 / 19)
  })

  it('counts each game once per tag, even with duplicate tag ids.', () => {
    expect(result.tags.find(({ tagId }) => tagId === 1)?.gameCount).toBe(10)
  })

  it('only computes stats for tags with at least 10 games.', () => {
    const tag1 = result.tags.find(({ tagId }) => tagId === 1)
    const tag2 = result.tags.find(({ tagId }) => tagId === 2)

    expect(tag1?.stats?.gameCount).toBe(10)
    expect(tag2?.gameCount).toBe(9)
    expect(tag2?.stats).toBeUndefined()
  })

  it("excludes the tag itself from its related tags.", () => {
    const tag1 = result.tags.find(({ tagId }) => tagId === 1)

    expect(tag1?.stats?.relatedTags.map(({ tagId }) => tagId)).toEqual([3])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest app/market/market-game.spec.ts app/market/compute-all.spec.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement**

`app/market/market-game.ts`:

```ts
import type { MarketGame } from '~/market/stats'

export interface MarketGameDocument {
  gameId: number
  slug: string
  grossRevenue: number
  basePrice?: number
  releaseYear?: number
  tagIds?: number[]
  reviewCount?: number
  details?: {
    name?: string
    developers?: string[]
    publishers?: string[]
  }
}

export const MARKET_GAME_PROJECTION = {
  _id: 0,
  gameId: 1,
  slug: 1,
  grossRevenue: 1,
  basePrice: 1,
  releaseYear: 1,
  tagIds: 1,
  reviewCount: 1,
  'details.name': 1,
  'details.developers': 1,
  'details.publishers': 1
}

export function toMarketGame(document: MarketGameDocument): MarketGame {
  return {
    gameId: document.gameId,
    name: document.details?.name ?? '',
    slug: document.slug,
    grossRevenue: document.grossRevenue,
    basePrice: document.basePrice ?? 0,
    releaseYear: document.releaseYear,
    tagIds: document.tagIds ?? [],
    reviewCount: document.reviewCount ?? 0,
    developers: document.details?.developers ?? [],
    publishers: document.details?.publishers ?? []
  }
}
```

`app/market/compute-all.ts`:

```ts
import { MIN_GAMES_FOR_PAGE } from '~/market/constants'
import {
  computeMarketStats,
  tagFrequencies,
  type MarketGame,
  type MarketStats,
  type TagFrequencies
} from '~/market/stats'

export interface TagStatsResult {
  tagId: number
  gameCount: number
  stats?: MarketStats
}

export interface AllTagStats {
  baseline: { stats: MarketStats; tagFrequencies: TagFrequencies }
  tags: TagStatsResult[]
}

export function computeAllTagStats(games: MarketGame[]): AllTagStats {
  const frequencies = tagFrequencies(games)
  const groups = new Map<number, MarketGame[]>()

  for (const game of games) {
    for (const tagId of new Set(game.tagIds)) {
      const members = groups.get(tagId)

      if (members) {
        members.push(game)
      } else {
        groups.set(tagId, [game])
      }
    }
  }

  const tags = [...groups]
    .sort(([a], [b]) => a - b)
    .map(([tagId, members]) => ({
      tagId,
      gameCount: members.length,
      stats:
        members.length >= MIN_GAMES_FOR_PAGE
          ? computeMarketStats(members, frequencies, [tagId])
          : undefined
    }))

  return {
    baseline: {
      stats: computeMarketStats(games, frequencies),
      tagFrequencies: frequencies
    },
    tags
  }
}
```

`app/market/market-service.server.ts`:

```ts
import { getCollection } from '~/db'
import {
  MARKET_GAME_PROJECTION,
  toMarketGame,
  type MarketGameDocument
} from '~/market/market-game'
import type { MarketGame } from '~/market/stats'

export async function loadMarketGames(
  query: Record<string, unknown>
): Promise<MarketGame[]> {
  const collection = await getCollection('games')

  const documents = (await collection
    .find(query)
    .project(MARKET_GAME_PROJECTION)
    .toArray()) as MarketGameDocument[]

  return documents.map(toMarketGame)
}
```

`app/routes/api.compute-stats.ts`:

```ts
import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'

import { getCollection } from '~/db'
import { computeAllTagStats } from '~/market/compute-all'
import { loadMarketGames } from '~/market/market-service.server'

export const loader: LoaderFunction = async ({ request }) => {
  const key = new URL(request.url).searchParams.get('key')
  const expectedKey = process.env.SCRAPE_KEY

  if (!expectedKey || !key || key !== expectedKey) {
    return new Response('Unauthorized.', { status: 401 })
  }

  // Only games scraped since tags were introduced carry tagIds.
  const games = await loadMarketGames({ 'tagIds.0': { $exists: true } })
  const { baseline, tags } = computeAllTagStats(games)
  const now = new Date()

  const marketStats = await getCollection('marketStats')

  await marketStats.updateOne(
    { _id: 'all' },
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

  return json({
    games: games.length,
    tags: tagIds.length,
    tagsWithStats: tags.filter(({ stats }) => stats).length
  })
}
```

Give the serverless function enough time for the compute job. In `vercel.json`, add a top-level key next to `"headers"`:

```json
  "functions": {
    "api/index.js": {
      "maxDuration": 60
    }
  },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest app/market`
Expected: PASS (all market tests)

- [ ] **Step 5: Manual check**

With local Mongo populated by Task 3's manual scrape, open `http://localhost:3000/api/compute-stats?key=<SCRAPE_KEY>`.
Expected: JSON `{ games: n, tags: ~450, tagsWithStats: m }`, plus a `marketStats` document `_id: 'all'` and `tags` documents carrying `stats`.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc`
Expected: no errors

```bash
git add app/market/market-game.ts app/market/market-game.spec.ts app/market/compute-all.ts app/market/compute-all.spec.ts app/market/market-service.server.ts app/routes/api.compute-stats.ts vercel.json
git commit -m "feat: precompute per-tag market stats"
```

---

### Task 6: Filter parsing and query building

**Files:**
- Create: `app/market/filters.ts`
- Test: `app/market/filters.spec.ts`

**Interfaces:**
- Produces:
  - `MarketFilters = { minPrice?: number; maxPrice?: number; since?: number; until?: number; withTagIds: number[]; unknownTags: string[] }`. Prices are in cents.
  - `parseMarketFilters(params: URLSearchParams, slugToTagId: Map<string, number>, ownTagId: number): MarketFilters`
  - `isFiltered(filters: MarketFilters): boolean`
  - `buildMarketQuery(tagId: number, filters: MarketFilters): Record<string, unknown>`

- [ ] **Step 1: Write the failing test**

`app/market/filters.spec.ts`:

```ts
import {
  buildMarketQuery,
  isFiltered,
  parseMarketFilters
} from '~/market/filters'

const slugs = new Map([
  ['roguelike', 1],
  ['deckbuilder', 2],
  ['turn-based', 3]
])

function parse(query: string) {
  return parseMarketFilters(new URLSearchParams(query), slugs, 1)
}

describe('parseMarketFilters', () => {
  it('parses a dollar price range into cents.', () => {
    expect(parse('price=10-20')).toMatchObject({ minPrice: 1000, maxPrice: 2000 })
    expect(parse('price=30-')).toMatchObject({ minPrice: 3000, maxPrice: undefined })
    expect(parse('price=-5')).toMatchObject({ minPrice: undefined, maxPrice: 500 })
    expect(parse('price=9.99-14.5')).toMatchObject({ minPrice: 999, maxPrice: 1450 })
  })

  it('swaps an inverted price range.', () => {
    expect(parse('price=20-10')).toMatchObject({ minPrice: 1000, maxPrice: 2000 })
  })

  it.each(['abc', '15', '-', '', '10-20-30'])('ignores the malformed price %p.', (price) => {
    const filters = parse(`price=${price}`)

    expect(filters.minPrice).toBeUndefined()
    expect(filters.maxPrice).toBeUndefined()
  })

  it('parses release years and swaps an inverted range.', () => {
    expect(parse('since=2021')).toMatchObject({ since: 2021, until: undefined })
    expect(parse('since=2024&until=2020')).toMatchObject({ since: 2020, until: 2024 })
  })

  it.each(['99', '20211', 'abc', '1900', ''])('ignores the malformed year %p.', (year) => {
    expect(parse(`since=${year}`).since).toBeUndefined()
  })

  it('resolves with-tags from commas and repeated params, case-insensitively, deduped.', () => {
    expect(parse('with=Deckbuilder,turn-based&with=deckbuilder').withTagIds).toEqual([2, 3])
  })

  it("drops the page's own tag silently and reports unknown slugs.", () => {
    const filters = parse('with=roguelike,nope,deckbuilder')

    expect(filters.withTagIds).toEqual([2])
    expect(filters.unknownTags).toEqual(['nope'])
  })
})

describe('isFiltered', () => {
  it('is false for a blank form submission.', () => {
    expect(isFiltered(parse('price=&since=&until=&with='))).toBe(false)
  })

  it('is true when any filter applies.', () => {
    expect(isFiltered(parse('since=2021'))).toBe(true)
    expect(isFiltered(parse('with=deckbuilder'))).toBe(true)
  })

  it('is false when only unknown tags were given.', () => {
    expect(isFiltered(parse('with=nope'))).toBe(false)
  })
})

describe('buildMarketQuery', () => {
  it('matches the tag only when no filters apply.', () => {
    expect(buildMarketQuery(1, parse(''))).toEqual({ tagIds: { $all: [1] } })
  })

  it('combines tags, price and year bounds.', () => {
    expect(
      buildMarketQuery(1, parse('price=10-20&since=2021&with=deckbuilder'))
    ).toEqual({
      tagIds: { $all: [1, 2] },
      basePrice: { $gte: 1000, $lte: 2000 },
      releaseYear: { $gte: 2021 }
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/market/filters.spec.ts`
Expected: FAIL with "Cannot find module '~/market/filters'"

- [ ] **Step 3: Implement**

`app/market/filters.ts`:

```ts
export interface MarketFilters {
  minPrice?: number
  maxPrice?: number
  since?: number
  until?: number
  withTagIds: number[]
  unknownTags: string[]
}

const pricePattern = /^(\d+(?:\.\d+)?)?-(\d+(?:\.\d+)?)?$/
const yearPattern = /^\d{4}$/
const firstSteamYear = 2003
const lastYear = 2100

export function parseMarketFilters(
  params: URLSearchParams,
  slugToTagId: Map<string, number>,
  ownTagId: number
): MarketFilters {
  const [minPrice, maxPrice] = ordered(...parsePrice(params.get('price')))
  const [since, until] = ordered(
    parseYear(params.get('since')),
    parseYear(params.get('until'))
  )

  const slugs = [
    ...new Set(
      params
        .getAll('with')
        .flatMap((value) => value.split(','))
        .map((slug) => slug.trim().toLowerCase())
        .filter(Boolean)
    )
  ]

  const withTagIds: number[] = []
  const unknownTags: string[] = []

  for (const slug of slugs) {
    const tagId = slugToTagId.get(slug)

    if (tagId === undefined) {
      unknownTags.push(slug)
    } else if (tagId !== ownTagId && !withTagIds.includes(tagId)) {
      withTagIds.push(tagId)
    }
  }

  return { minPrice, maxPrice, since, until, withTagIds, unknownTags }
}

export function isFiltered(filters: MarketFilters): boolean {
  return (
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.since !== undefined ||
    filters.until !== undefined ||
    filters.withTagIds.length > 0
  )
}

export function buildMarketQuery(
  tagId: number,
  filters: MarketFilters
): Record<string, unknown> {
  const query: Record<string, unknown> = {
    tagIds: { $all: [tagId, ...filters.withTagIds] }
  }

  const price = range(filters.minPrice, filters.maxPrice)
  const year = range(filters.since, filters.until)

  if (price) {
    query.basePrice = price
  }

  if (year) {
    query.releaseYear = year
  }

  return query
}

function parsePrice(
  value: string | null
): [number | undefined, number | undefined] {
  const match = pricePattern.exec(value ?? '')

  if (!match || (!match[1] && !match[2])) {
    return [undefined, undefined]
  }

  const toCents = (dollars?: string) =>
    dollars === undefined ? undefined : Math.round(parseFloat(dollars) * 100)

  return [toCents(match[1]), toCents(match[2])]
}

function parseYear(value: string | null): number | undefined {
  if (!value || !yearPattern.test(value)) {
    return
  }

  const year = parseInt(value, 10)

  return year >= firstSteamYear && year <= lastYear ? year : undefined
}

function ordered(
  low: number | undefined,
  high: number | undefined
): [number | undefined, number | undefined] {
  return low !== undefined && high !== undefined && low > high
    ? [high, low]
    : [low, high]
}

function range(
  low: number | undefined,
  high: number | undefined
): Record<string, number> | undefined {
  if (low === undefined && high === undefined) {
    return
  }

  return {
    ...(low !== undefined ? { $gte: low } : {}),
    ...(high !== undefined ? { $lte: high } : {})
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/market/filters.spec.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add app/market/filters.ts app/market/filters.spec.ts
git commit -m "feat: parse tag page filters into a Mongo query"
```

---

### Task 7: Tag page `/tags/:slug`

**Files:**
- Create: `app/market/format.ts`
- Create: `app/market/components/bar-list.tsx`
- Create: `app/market/components/filter-form.tsx`
- Create: `app/routes/tags.$slug.tsx`
- Modify: `app/market/market-service.server.ts` (add tag/baseline reads)
- Test: `app/market/format.spec.ts`, `app/tests/routes/tag-page.spec.tsx`

**Interfaces:**
- Consumes: `computeMarketStats`, `MarketStats`, `TagFrequencies` (Task 4); `loadMarketGames` (Task 5); `parseMarketFilters`, `isFiltered`, `buildMarketQuery` (Task 6); constants (Task 3)
- Produces:
  - `formatCompactCurrency(amount: number): string`, `formatPercent(share: number): string`, `formatDate(value: string | Date): string` (`~/market/format`)
  - In `~/market/market-service.server`:
    - `TagRecord = { tagId; name; slug; gameCount; stats?: MarketStats; statsUpdatedAt?: Date }`
    - `TagIndexEntry = { tagId: number; name: string; slug: string; hasPage: boolean }`
    - `Baseline = { stats: MarketStats; tagFrequencies: TagFrequencies; updatedAt: Date }`
    - `getTagIndex(): Promise<TagIndexEntry[]>`, `getTagBySlug(slug: string): Promise<TagRecord | null>`, `getBaseline(): Promise<Baseline | null>`
  - `BarList` component: props `{ rows: BarListRow[]; testId?: string }`, where `BarListRow = { label: string; value: number; display: string; note?: string }`
  - `FilterForm` component: props `{ action: string; values: FilterValues; tagOptions: { slug: string; name: string }[] }`, where `FilterValues = { price: string; since: string; until: string; with: string }`
  - Tag route `LoaderData` (used by the smoke test), shown below

- [ ] **Step 1: Write the failing format test**

`app/market/format.spec.ts`:

```ts
import { formatCompactCurrency, formatDate, formatPercent } from '~/market/format'

describe('format', () => {
  it('formats compact currency.', () => {
    expect(formatCompactCurrency(950)).toBe('$950')
    expect(formatCompactCurrency(12_300)).toBe('$12.3K')
    expect(formatCompactCurrency(4_000_000)).toBe('$4M')
  })

  it('formats shares as whole percentages, keeping small non-zero shares visible.', () => {
    expect(formatPercent(0.123)).toBe('12%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(0.002)).toBe('<1%')
  })

  it('formats dates in UTC so server and client agree.', () => {
    expect(formatDate('2026-10-12T23:30:00Z')).toBe('October 12, 2026')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/market/format.spec.ts`
Expected: FAIL with "Cannot find module '~/market/format'"

- [ ] **Step 3: Implement format**

`app/market/format.ts`:

```ts
const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1
})

export function formatCompactCurrency(amount: number): string {
  return compactCurrency.format(Math.round(amount))
}

export function formatPercent(share: number): string {
  if (share > 0 && share < 0.01) {
    return '<1%'
  }

  return `${Math.round(share * 100)}%`
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  })
}
```

Run: `npx jest app/market/format.spec.ts`
Expected: PASS

- [ ] **Step 4: Add tag reads to the market service**

Append to `app/market/market-service.server.ts`, and add `MarketStats, TagFrequencies` to its `~/market/stats` type import:

```ts
export interface TagRecord {
  tagId: number
  name: string
  slug: string
  gameCount: number
  stats?: MarketStats
  statsUpdatedAt?: Date
}

export interface TagIndexEntry {
  tagId: number
  name: string
  slug: string
  hasPage: boolean
}

export interface Baseline {
  stats: MarketStats
  tagFrequencies: TagFrequencies
  updatedAt: Date
}

const tagIndexTtlMs = 10 * 60 * 1000

let tagIndexCache: { entries: TagIndexEntry[]; expiresAt: number } | undefined

export async function getTagIndex(): Promise<TagIndexEntry[]> {
  if (tagIndexCache && tagIndexCache.expiresAt > Date.now()) {
    return tagIndexCache.entries
  }

  const collection = await getCollection('tags')

  const documents = (await collection
    .find({})
    .project({ _id: 0, tagId: 1, name: 1, slug: 1, 'stats.gameCount': 1 })
    .toArray()) as { tagId: number; name: string; slug: string; stats?: object }[]

  const entries = documents
    .map(({ tagId, name, slug, stats }) => ({
      tagId,
      name,
      slug,
      hasPage: Boolean(stats)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  tagIndexCache = { entries, expiresAt: Date.now() + tagIndexTtlMs }

  return entries
}

export async function getTagBySlug(slug: string): Promise<TagRecord | null> {
  const collection = await getCollection('tags')

  return (await collection.findOne(
    { slug },
    { projection: { _id: 0 } }
  )) as TagRecord | null
}

export async function getBaseline(): Promise<Baseline | null> {
  const collection = await getCollection('marketStats')

  return (await collection.findOne(
    { _id: 'all' },
    { projection: { _id: 0 } }
  )) as Baseline | null
}
```

- [ ] **Step 5: Create the components**

`app/market/components/bar-list.tsx`:

```tsx
import type { ReactElement } from 'react'

export interface BarListRow {
  label: string
  value: number
  display: string
  note?: string
}

export function BarList({
  rows,
  testId
}: {
  rows: BarListRow[]
  testId?: string
}): ReactElement {
  const max = Math.max(0, ...rows.map(({ value }) => value))

  return (
    <div
      className="space-y-2"
      data-testid={testId}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[6.5rem_1fr_7rem] gap-4 items-center text-sm"
        >
          <div className="text-paper-muted tabular-nums">{row.label}</div>
          <div className="h-3 bg-rule/40">
            <div
              className="h-full bg-accent"
              style={{ width: max > 0 ? `${(row.value / max) * 100}%` : '0%' }}
            />
          </div>
          <div className="text-right tabular-nums">
            {row.display}
            {row.note && <span className="text-paper-dim ml-2">{row.note}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
```

`app/market/components/filter-form.tsx`:

```tsx
import type { ReactElement } from 'react'

export interface FilterValues {
  price: string
  since: string
  until: string
  with: string
}

const priceOptions = [
  ['', 'Any price'],
  ['-5', 'Under $5'],
  ['5-10', '$5–10'],
  ['10-15', '$10–15'],
  ['15-20', '$15–20'],
  ['20-30', '$20–30'],
  ['30-', '$30+']
]

const fieldClassName =
  'bg-transparent border-b border-rule-strong py-1 text-paper focus:outline-none focus:border-accent'

export function FilterForm({
  action,
  values,
  tagOptions
}: {
  action: string
  values: FilterValues
  tagOptions: { slug: string; name: string }[]
}): ReactElement {
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-x-8 gap-y-4 border-y border-rule py-4 text-sm"
      method="get"
    >
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Price</span>
        <select
          className={fieldClassName}
          defaultValue={values.price}
          name="price"
        >
          {priceOptions.map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Released from</span>
        <input
          className={`${fieldClassName} w-20`}
          defaultValue={values.since}
          max={2100}
          min={2003}
          name="since"
          placeholder="Any"
          type="number"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Released until</span>
        <input
          className={`${fieldClassName} w-20`}
          defaultValue={values.until}
          max={2100}
          min={2003}
          name="until"
          placeholder="Any"
          type="number"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Also tagged</span>
        <select
          className={fieldClassName}
          defaultValue={values.with.split(',')[0] ?? ''}
          name="with"
        >
          <option value="">Any</option>
          {tagOptions.map(({ slug, name }) => (
            <option
              key={slug}
              value={slug}
            >
              {name}
            </option>
          ))}
        </select>
      </label>

      <button
        className="text-accent hover:text-accent-strong underline underline-offset-4"
        type="submit"
      >
        Apply
      </button>
      <a
        className="text-paper-muted hover:text-paper"
        href={action}
      >
        Clear
      </a>
    </form>
  )
}
```

- [ ] **Step 6: Write the failing route smoke test**

`app/tests/routes/tag-page.spec.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import * as remix from '@remix-run/react'

import { computeMarketStats, type MarketGame } from '~/market/stats'
import TagRoute, { type LoaderData } from '~/routes/tags.$slug'

function games(count: number): MarketGame[] {
  return Array.from({ length: count }, (_, index) => ({
    gameId: index + 1,
    name: `Roguelike ${index + 1}`,
    slug: `roguelike-${index + 1}`,
    grossRevenue: (index + 1) * 10_000,
    basePrice: 1499,
    releaseYear: 2020 + (index % 3),
    tagIds: [1],
    reviewCount: 100,
    developers: [`Studio ${index % 2}`],
    publishers: ['Pub'],
  }))
}

function loaderData(overrides: Partial<LoaderData> = {}): LoaderData {
  const stats = computeMarketStats(games(12))

  return {
    tag: { name: 'Roguelike', slug: 'roguelike' },
    stats,
    baseline: computeMarketStats(games(40)),
    statsUpdatedAt: '2026-10-12T00:00:00.000Z',
    isFiltered: false,
    filterValues: { price: '', since: '', until: '', with: '' },
    unknownTags: [],
    relatedTags: [
      { tagId: 2, name: 'Deckbuilder', slug: 'deckbuilder', hasPage: true, count: 6, lift: 4 }
    ],
    tagOptions: [{ slug: 'deckbuilder', name: 'Deckbuilder' }],
    ...overrides
  }
}

function renderWith(data: LoaderData) {
  const spy = jest.spyOn(remix, 'useLoaderData')

  // @ts-ignore
  spy.mockImplementation(() => data)

  render(
    <MemoryRouter>
      <TagRoute />
    </MemoryRouter>
  )
}

describe('TagRoute', () => {
  it('shows headline figures, top games and related tags.', () => {
    renderWith(loaderData())

    expect(screen.getByTestId('title')).toHaveTextContent(
      'How much do Roguelike games make on Steam?'
    )
    expect(screen.getByTestId('median')).toHaveTextContent('$65K')
    expect(screen.getByText('Roguelike 12')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Deckbuilder' })).toHaveAttribute(
      'href',
      '/tags/deckbuilder'
    )
    expect(screen.getByTestId('distribution')).toBeInTheDocument()
  })

  it('hides the statistics for small filtered samples but keeps the game list.', () => {
    renderWith(
      loaderData({ stats: computeMarketStats(games(3)), isFiltered: true })
    )

    expect(screen.getByText(/not enough games/i)).toBeInTheDocument()
    expect(screen.queryByTestId('distribution')).not.toBeInTheDocument()
    expect(screen.getByText('Roguelike 3')).toBeInTheDocument()
  })

  it('lists unknown tags from the filter.', () => {
    renderWith(loaderData({ unknownTags: ['nope'], isFiltered: true }))

    expect(screen.getByText(/nope/)).toBeInTheDocument()
  })
})
```

Check the expected median: revenues 10k…120k, 12 values; p50 = (60k + 70k) / 2 = 65k → `$65K`.

Run: `npx jest app/tests/routes/tag-page.spec.tsx`
Expected: FAIL with "Cannot find module '~/routes/tags.$slug'"

- [ ] **Step 7: Implement the route**

`app/routes/tags.$slug.tsx`:

```tsx
import type {
  HeadersFunction,
  LoaderFunction,
  V2_MetaFunction
} from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import type { ReactElement } from 'react'

import { Page } from '~/components/page'
import { BarList } from '~/market/components/bar-list'
import { FilterForm, type FilterValues } from '~/market/components/filter-form'
import {
  CANONICAL_CACHE_CONTROL,
  FILTERED_CACHE_CONTROL,
  MIN_GAMES_FOR_STATS,
  SITE_URL
} from '~/market/constants'
import {
  buildMarketQuery,
  isFiltered,
  parseMarketFilters
} from '~/market/filters'
import {
  formatCompactCurrency,
  formatDate,
  formatPercent
} from '~/market/format'
import {
  getBaseline,
  getTagBySlug,
  getTagIndex,
  loadMarketGames
} from '~/market/market-service.server'
import {
  computeMarketStats,
  type MarketStats,
  type RelatedTag,
  type TopCompany
} from '~/market/stats'

export interface LoaderData {
  tag: { name: string; slug: string }
  stats: MarketStats
  baseline: MarketStats | null
  statsUpdatedAt: string
  isFiltered: boolean
  filterValues: FilterValues
  unknownTags: string[]
  relatedTags: (RelatedTag & { name: string; slug: string; hasPage: boolean })[]
  tagOptions: { slug: string; name: string }[]
}

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? CANONICAL_CACHE_CONTROL
})

export const loader: LoaderFunction = async ({ params, request }) => {
  const tag = await getTagBySlug(params.slug ?? '')

  if (!tag || !tag.stats) {
    throw new Response(null, { status: 404, statusText: 'Tag Not Found.' })
  }

  const [baseline, tagIndex] = await Promise.all([getBaseline(), getTagIndex()])
  const searchParams = new URL(request.url).searchParams
  const filters = parseMarketFilters(
    searchParams,
    new Map(tagIndex.map(({ slug, tagId }) => [slug, tagId])),
    tag.tagId
  )
  const filtered = isFiltered(filters)

  const stats = filtered
    ? computeMarketStats(
        await loadMarketGames(buildMarketQuery(tag.tagId, filters)),
        baseline?.tagFrequencies,
        [tag.tagId, ...filters.withTagIds]
      )
    : tag.stats

  const tagsById = new Map(tagIndex.map((entry) => [entry.tagId, entry]))

  const data: LoaderData = {
    tag: { name: tag.name, slug: tag.slug },
    stats,
    baseline: baseline?.stats ?? null,
    statsUpdatedAt: new Date(tag.statsUpdatedAt ?? Date.now()).toISOString(),
    isFiltered: filtered,
    filterValues: {
      price: searchParams.get('price') ?? '',
      since: searchParams.get('since') ?? '',
      until: searchParams.get('until') ?? '',
      with: searchParams.getAll('with').join(',')
    },
    unknownTags: filters.unknownTags,
    relatedTags: stats.relatedTags.flatMap((related) => {
      const entry = tagsById.get(related.tagId)

      return entry ? [{ ...related, ...entry }] : []
    }),
    tagOptions: tagIndex
      .filter(({ hasPage, tagId }) => hasPage && tagId !== tag.tagId)
      .map(({ slug, name }) => ({ slug, name }))
  }

  return json(data, {
    headers: {
      'Cache-Control': filtered
        ? FILTERED_CACHE_CONTROL
        : CANONICAL_CACHE_CONTROL
    }
  })
}

export const meta: V2_MetaFunction = ({ data }) => {
  if (!data) {
    return [{ title: 'Tag not found — Steam Revenue Calculator' }]
  }

  const { tag, stats, isFiltered: filtered } = data as LoaderData
  const title = `How much do ${tag.name} games make on Steam? — Steam Revenue Calculator`
  const description = `Median revenue, revenue distribution, price bands and top earners for ${stats.gameCount.toLocaleString(
    'en-US'
  )} ${tag.name} games on Steam, estimated with the Boxleiter method.`
  const url = `${SITE_URL}/tags/${tag.slug}`

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { tagName: 'link', rel: 'canonical', href: url },
    ...(filtered ? [{ name: 'robots', content: 'noindex, follow' }] : [])
  ]
}

export default function TagRoute(): ReactElement {
  const data = useLoaderData<LoaderData>()
  const { tag, stats, baseline } = data
  const enoughGames = stats.gameCount >= MIN_GAMES_FOR_STATS

  return (
    <Page>
      <div className="flex flex-col gap-12">
        <header className="flex flex-col gap-6 pt-4 md:pt-10 max-w-3xl">
          <div className="eyebrow">
            <Link
              className="hover:text-paper"
              to="/tags"
            >
              Tags
            </Link>{' '}
            · Data as of {formatDate(data.statsUpdatedAt)}
          </div>
          <h1
            className="font-display leading-[1.02]"
            data-testid="title"
          >
            How much do {tag.name} games make on Steam?
          </h1>
        </header>

        <FilterForm
          action={`/tags/${tag.slug}`}
          tagOptions={data.tagOptions}
          values={data.filterValues}
        />

        {data.unknownTags.length > 0 && (
          <p className="text-sm text-paper-muted">
            Ignored unknown tags: {data.unknownTags.join(', ')}
          </p>
        )}

        {enoughGames ? (
          <>
            <Headline
              baseline={baseline}
              stats={stats}
            />

            <Section title="How revenue is spread">
              <BarList
                rows={stats.distribution.map(({ label, count }) => ({
                  label,
                  value: count,
                  display: count.toLocaleString('en-US')
                }))}
                testId="distribution"
              />
            </Section>

            <Section title="Median revenue by price">
              <BarList
                rows={stats.priceBands.map(({ label, count, median }) => ({
                  label,
                  value: median,
                  display: count > 0 ? formatCompactCurrency(median) : '—',
                  note: `${count.toLocaleString('en-US')} games`
                }))}
              />
            </Section>

            <Section title="Median revenue by release year">
              <BarList
                rows={stats.byYear.map(({ year, count, median }) => ({
                  label: String(year),
                  value: median,
                  display: formatCompactCurrency(median),
                  note: `${count.toLocaleString('en-US')} games`
                }))}
              />
            </Section>
          </>
        ) : (
          <p className="text-paper-muted">
            Not enough games match these filters for reliable statistics.
            Showing the {stats.gameCount} that do.
          </p>
        )}

        <Section title="Top games">
          <ol className="divide-y divide-rule">
            {stats.topGames.map((game, index) => (
              <li key={game.gameId}>
                <Link
                  className="grid grid-cols-[2.5rem_1fr_auto] gap-4 py-2 hover:text-accent"
                  to={`/app/${game.gameId}/${game.slug}`}
                >
                  <span className="text-paper-muted tabular-nums">
                    {index + 1}
                  </span>
                  <span className="truncate">{game.name}</span>
                  <span className="tabular-nums">
                    {formatCompactCurrency(game.grossRevenue)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Section>

        {enoughGames && (
          <div className="grid gap-12 md:grid-cols-2">
            <CompanyList
              companies={stats.topDevelopers}
              title="Top developers"
            />
            <CompanyList
              companies={stats.topPublishers}
              title="Top publishers"
            />
          </div>
        )}

        {data.relatedTags.length > 0 && (
          <Section title="Related tags">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {data.relatedTags.map((related) => (
                <li key={related.tagId}>
                  {related.hasPage ? (
                    <Link
                      className="text-accent hover:text-accent-strong underline underline-offset-4 decoration-accent/40"
                      to={`/tags/${related.slug}`}
                    >
                      {related.name}
                    </Link>
                  ) : (
                    <span>{related.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </Page>
  )
}

function Headline({
  stats,
  baseline
}: {
  stats: MarketStats
  baseline: MarketStats | null
}): ReactElement {
  const figures = [
    {
      label: 'Median revenue',
      value: formatCompactCurrency(stats.percentiles.p50),
      compare: baseline && formatCompactCurrency(baseline.percentiles.p50),
      testId: 'median'
    },
    {
      label: 'Middle half earn',
      value: `${formatCompactCurrency(stats.percentiles.p25)}–${formatCompactCurrency(stats.percentiles.p75)}`,
      compare: null,
      testId: 'middle-half'
    },
    {
      label: 'Top 10% earn over',
      value: formatCompactCurrency(stats.percentiles.p90),
      compare: baseline && formatCompactCurrency(baseline.percentiles.p90),
      testId: 'p90'
    },
    {
      label: 'Earn over $100K',
      value: formatPercent(stats.shareAbove.hundredThousand),
      compare: baseline && formatPercent(baseline.shareAbove.hundredThousand),
      testId: 'share-100k'
    },
    {
      label: 'Games',
      value: stats.gameCount.toLocaleString('en-US'),
      compare: null,
      testId: 'game-count'
    }
  ]

  return (
    <section className="grid grid-cols-2 md:grid-cols-5 gap-8 border-b border-rule pb-8">
      {figures.map((figure) => (
        <div
          key={figure.label}
          className="space-y-1.5"
        >
          <div className="eyebrow">{figure.label}</div>
          <div
            className="font-sans text-2xl tabular-nums"
            data-testid={figure.testId}
          >
            {figure.value}
          </div>
          {figure.compare && (
            <div className="text-xs text-paper-dim">
              All Steam: {figure.compare}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: ReactElement
}): ReactElement {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl">{title}</h2>
      {children}
    </section>
  )
}

function CompanyList({
  title,
  companies
}: {
  title: string
  companies: TopCompany[]
}): ReactElement {
  return (
    <Section title={title}>
      <ol className="divide-y divide-rule text-sm">
        {companies.map((company) => (
          <li
            key={company.name}
            className="flex justify-between gap-4 py-2"
          >
            <span className="truncate">{company.name}</span>
            <span className="text-paper-muted tabular-nums shrink-0">
              {company.gameCount} games · {formatCompactCurrency(company.revenue)}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  )
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx jest app/tests/routes/tag-page.spec.tsx`
Expected: PASS (3 tests)

- [ ] **Step 9: Manual check in the browser**

With the Task 5 data loaded, run `npm run dev` and open:
- `/tags/roguelike`: full report. The page source has a canonical link and no robots meta.
- `/tags/roguelike?price=10-20&since=2021`: numbers change, and `<meta name="robots" content="noindex, follow">` is present.
- `/tags/roguelike?with=nope`: unfiltered stats plus the "Ignored unknown tags" note.
- `/tags/does-not-exist`: 404.

- [ ] **Step 10: Typecheck and commit**

Run: `npx tsc && npx jest`
Expected: no errors; all tests PASS

```bash
git add app/market/format.ts app/market/format.spec.ts app/market/components app/market/market-service.server.ts app/routes/tags.\$slug.tsx app/tests/routes/tag-page.spec.tsx
git commit -m "feat: tag market page with live filters"
```

---

### Task 8: Tag index `/tags`

**Files:**
- Create: `app/market/tag-summaries.ts`
- Create: `app/routes/tags._index.tsx`
- Modify: `app/market/market-service.server.ts` (add `listTagSummaries`)
- Test: `app/market/tag-summaries.spec.ts`, `app/tests/routes/tags-index.spec.tsx`

**Interfaces:**
- Consumes: `getCollection`; format helpers (Task 7); constants (Task 3)
- Produces:
  - `TagSummary = { name: string; slug: string; gameCount: number; median: number; shareAboveHundredThousand: number }`
  - `TagSort = 'median' | 'count' | 'share'`
  - `parseTagSort(value: string | null): TagSort`
  - `sortTagSummaries(summaries: TagSummary[], sort: TagSort): TagSummary[]`
  - `listTagSummaries(): Promise<TagSummary[]>` in `~/market/market-service.server`

- [ ] **Step 1: Write the failing tests**

`app/market/tag-summaries.spec.ts`:

```ts
import { parseTagSort, sortTagSummaries } from '~/market/tag-summaries'

const summaries = [
  { name: 'B', slug: 'b', gameCount: 50, median: 1000, shareAboveHundredThousand: 0.3 },
  { name: 'A', slug: 'a', gameCount: 500, median: 1000, shareAboveHundredThousand: 0.1 },
  { name: 'C', slug: 'c', gameCount: 20, median: 9000, shareAboveHundredThousand: 0.2 }
]

describe('sortTagSummaries', () => {
  it('sorts descending by the chosen column, breaking ties by name.', () => {
    expect(sortTagSummaries(summaries, 'median').map(({ slug }) => slug)).toEqual(['c', 'a', 'b'])
    expect(sortTagSummaries(summaries, 'count').map(({ slug }) => slug)).toEqual(['a', 'b', 'c'])
    expect(sortTagSummaries(summaries, 'share').map(({ slug }) => slug)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate its input.', () => {
    sortTagSummaries(summaries, 'count')

    expect(summaries[0].slug).toBe('b')
  })
})

describe('parseTagSort', () => {
  it('defaults unknown values to median.', () => {
    expect(parseTagSort('count')).toBe('count')
    expect(parseTagSort('share')).toBe('share')
    expect(parseTagSort('bogus')).toBe('median')
    expect(parseTagSort(null)).toBe('median')
  })
})
```

`app/tests/routes/tags-index.spec.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import * as remix from '@remix-run/react'

import TagsIndexRoute from '~/routes/tags._index'

describe('TagsIndexRoute', () => {
  it('lists tags with links and figures.', () => {
    const spy = jest.spyOn(remix, 'useLoaderData')

    // @ts-ignore
    spy.mockImplementation(() => ({
      sort: 'median',
      tags: [
        { name: 'Roguelike', slug: 'roguelike', gameCount: 1200, median: 42_000, shareAboveHundredThousand: 0.31 }
      ]
    }))

    render(
      <MemoryRouter>
        <TagsIndexRoute />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Roguelike' })).toHaveAttribute('href', '/tags/roguelike')
    expect(screen.getByText('$42K')).toBeInTheDocument()
    expect(screen.getByText('31%')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest app/market/tag-summaries.spec.ts app/tests/routes/tags-index.spec.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement**

`app/market/tag-summaries.ts`:

```ts
export interface TagSummary {
  name: string
  slug: string
  gameCount: number
  median: number
  shareAboveHundredThousand: number
}

export type TagSort = 'median' | 'count' | 'share'

const sortKeys: Record<TagSort, (summary: TagSummary) => number> = {
  median: ({ median }) => median,
  count: ({ gameCount }) => gameCount,
  share: ({ shareAboveHundredThousand }) => shareAboveHundredThousand
}

export function parseTagSort(value: string | null): TagSort {
  return value === 'count' || value === 'share' ? value : 'median'
}

export function sortTagSummaries(
  summaries: TagSummary[],
  sort: TagSort
): TagSummary[] {
  const key = sortKeys[sort]

  return [...summaries].sort(
    (a, b) => key(b) - key(a) || a.name.localeCompare(b.name)
  )
}
```

Append to `app/market/market-service.server.ts`, and add `import type { TagSummary } from '~/market/tag-summaries'`:

```ts
export async function listTagSummaries(): Promise<TagSummary[]> {
  const collection = await getCollection('tags')

  const documents = (await collection
    .find({ stats: { $exists: true } })
    .project({
      _id: 0,
      name: 1,
      slug: 1,
      gameCount: 1,
      'stats.percentiles.p50': 1,
      'stats.shareAbove.hundredThousand': 1
    })
    .toArray()) as {
    name: string
    slug: string
    gameCount: number
    stats: {
      percentiles: { p50: number }
      shareAbove: { hundredThousand: number }
    }
  }[]

  return documents.map(({ name, slug, gameCount, stats }) => ({
    name,
    slug,
    gameCount,
    median: stats.percentiles.p50,
    shareAboveHundredThousand: stats.shareAbove.hundredThousand
  }))
}
```

`app/routes/tags._index.tsx`:

```tsx
import type {
  HeadersFunction,
  LoaderFunction,
  V2_MetaFunction
} from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import type { ReactElement } from 'react'

import { Page } from '~/components/page'
import { CANONICAL_CACHE_CONTROL, SITE_URL } from '~/market/constants'
import { formatCompactCurrency, formatPercent } from '~/market/format'
import { listTagSummaries } from '~/market/market-service.server'
import {
  parseTagSort,
  sortTagSummaries,
  type TagSort,
  type TagSummary
} from '~/market/tag-summaries'

interface LoaderData {
  sort: TagSort
  tags: TagSummary[]
}

const title = 'Steam tags ranked by revenue — Steam Revenue Calculator'
const description =
  'Which kinds of games make money on Steam? Every Steam tag ranked by median estimated revenue, number of games, and the share earning over $100K.'

export const headers: HeadersFunction = () => ({
  'Cache-Control': CANONICAL_CACHE_CONTROL
})

export const loader: LoaderFunction = async ({
  request
}): Promise<LoaderData> => {
  const sort = parseTagSort(new URL(request.url).searchParams.get('sort'))

  return { sort, tags: sortTagSummaries(await listTagSummaries(), sort) }
}

export const meta: V2_MetaFunction = () => [
  { title },
  { name: 'description', content: description },
  { property: 'og:title', content: title },
  { property: 'og:description', content: description },
  { property: 'og:url', content: `${SITE_URL}/tags` },
  { tagName: 'link', rel: 'canonical', href: `${SITE_URL}/tags` }
]

const columns: { sort: TagSort; label: string }[] = [
  { sort: 'count', label: 'Games' },
  { sort: 'median', label: 'Median' },
  { sort: 'share', label: 'Over $100K' }
]

export default function TagsIndexRoute(): ReactElement {
  const { sort, tags } = useLoaderData<LoaderData>()

  return (
    <Page>
      <div className="flex flex-col gap-12">
        <header className="flex flex-col gap-6 pt-4 md:pt-10 max-w-2xl">
          <div className="eyebrow">Markets</div>
          <h1 className="font-display leading-[1.02]">
            Steam tags by revenue
          </h1>
          <p className="text-lg text-paper-muted max-w-xl">
            What a typical game earns in each corner of Steam. Pick a tag for
            the full breakdown.
          </p>
        </header>

        <section>
          <div className="grid grid-cols-[1fr_5rem_6rem_6rem] gap-4 eyebrow pb-3 border-b border-rule-strong">
            <div>Tag</div>
            {columns.map((column) => (
              <Link
                key={column.sort}
                className={`text-right ${
                  sort === column.sort ? 'text-accent' : 'hover:text-paper'
                }`}
                to={`/tags?sort=${column.sort}`}
              >
                {column.label}
              </Link>
            ))}
          </div>

          <div className="divide-y divide-rule">
            {tags.map((tag) => (
              <div
                key={tag.slug}
                className="grid grid-cols-[1fr_5rem_6rem_6rem] gap-4 py-2 items-baseline"
              >
                <Link
                  className="font-display text-lg hover:text-accent truncate"
                  to={`/tags/${tag.slug}`}
                >
                  {tag.name}
                </Link>
                <div className="text-right tabular-nums text-paper-muted">
                  {tag.gameCount.toLocaleString('en-US')}
                </div>
                <div className="text-right tabular-nums">
                  {formatCompactCurrency(tag.median)}
                </div>
                <div className="text-right tabular-nums">
                  {formatPercent(tag.shareAboveHundredThousand)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Page>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest app/market/tag-summaries.spec.ts app/tests/routes/tags-index.spec.tsx`
Expected: PASS

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc`
Expected: no errors

```bash
git add app/market/tag-summaries.ts app/market/tag-summaries.spec.ts app/market/market-service.server.ts app/routes/tags._index.tsx app/tests/routes/tags-index.spec.tsx
git commit -m "feat: tag index ranked by revenue"
```

---

### Task 9: Tag links on game pages, sitemap and navigation

**Files:**
- Modify: `app/routes/app.$id.$slug.tsx`
- Modify: `app/routes/sitemap[.]xml.tsx`
- Modify: `app/components/page.tsx`
- Test: `app/tests/routes/game-page.spec.tsx`

**Interfaces:**
- Consumes: `getTagIndex()`, `TagIndexEntry` (Task 7)
- Produces: game page `LoaderData = { game: GameDetails; tags: TagIndexEntry[] }`

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/routes/game-page.spec.tsx` inside the `describe` block. The existing test has no `tags` in its mock and must keep passing, which covers documents not yet rescraped.

```tsx
  const rust = {
    id: 1,
    categories: [],
    description: 'A game about rugs and pumpkins.',
    developers: ['Facepunch Studios'],
    genres: [],
    metacritic: {},
    name: 'Rust',
    numberOfReviews: 32,
    publishers: ['Facepunch Studios'],
    price: 3999,
    screenshots: []
  }

  it('links tags that have a market page and lists the rest as text.', () => {
    const spy = jest.spyOn(remix, 'useLoaderData')

    // @ts-ignore
    spy.mockImplementation(() => ({
      game: rust,
      tags: [
        { tagId: 1, name: 'Survival', slug: 'survival', hasPage: true },
        { tagId: 2, name: 'Tiny Tag', slug: 'tiny-tag', hasPage: false }
      ]
    }))

    render(
      <MemoryRouter>
        <GameRoute />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Survival' })).toHaveAttribute('href', '/tags/survival')
    expect(screen.getByText('Tiny Tag').closest('a')).toBeNull()
  })

  it('renders no Metacritic block when there is no score.', () => {
    const spy = jest.spyOn(remix, 'useLoaderData')

    // @ts-ignore
    spy.mockImplementation(() => ({ game: rust, tags: [] }))

    render(
      <MemoryRouter>
        <GameRoute />
      </MemoryRouter>
    )

    expect(screen.queryByText('Metacritic')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest app/tests/routes/game-page.spec.tsx`
Expected: FAIL. No link named "Survival", and the "Metacritic" block renders for `{}`.

- [ ] **Step 3: Implement game page changes**

In `app/routes/app.$id.$slug.tsx`:

1. Add the import:

```tsx
import { getTagIndex, type TagIndexEntry } from '~/market/market-service.server'
```

2. Change `LoaderData` to:

```tsx
interface LoaderData {
  game: GameDetails
  tags: TagIndexEntry[]
}
```

3. Replace the loader's final `return { game: game.details }` with:

```tsx
  const tagIndex = await getTagIndex()
  const tagsById = new Map(tagIndex.map((tag) => [tag.tagId, tag]))

  return {
    game: game.details,
    tags: (game.tagIds ?? []).flatMap((tagId) => {
      const tag = tagsById.get(tagId)

      return tag ? [tag] : []
    })
  }
```

4. In the component, change `const { game } = useLoaderData<LoaderData>()` to:

```tsx
  const { game, tags = [] } = useLoaderData<LoaderData>()
```

5. Directly after the `<div className="text-paper-muted text-sm">…By…</div>` block, inside the same `flex flex-col gap-4` div, add:

```tsx
                {tags.length > 0 && (
                  <ul
                    className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
                    data-testid="tags"
                  >
                    {tags.map((tag) => (
                      <li key={tag.tagId}>
                        {tag.hasPage ? (
                          <Link
                            className="text-accent hover:text-accent-strong underline underline-offset-4 decoration-accent/40"
                            to={`/tags/${tag.slug}`}
                          >
                            {tag.name}
                          </Link>
                        ) : (
                          <span className="text-paper-muted">{tag.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
```

6. Change `{game.metacritic && (` to `{game.metacritic?.score && (`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest app/tests/routes/game-page.spec.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Sitemap**

In `app/routes/sitemap[.]xml.tsx`:

1. Change `.sort({ name: 1 })` to `.sort({ gameId: 1 })`.
2. After the `games` query, add:

```tsx
  const tagsCollection = await getCollection('tags')
  const tags = (await tagsCollection
    .find({ stats: { $exists: true } })
    .sort({ slug: 1 })
    .project({ _id: 0, slug: 1 })
    .toArray()) as { slug: string }[]

  const tagXml = tags
    .map((tag) => urlBlock(`/tags/${tag.slug}`, '0.8'))
    .join('\n')
```

3. In the `content` template, after `${urlBlock('/privacy')}`, add:

```
  ${urlBlock('/tags')}
  ${tagXml}
```

- [ ] **Step 6: Navigation**

In `app/components/page.tsx`, add a "Tags" link after the "Games" link in **both** the header and the footer nav, copying each nav's existing `Link` class names:

```tsx
          <Link
            className="text-paper-muted hover:text-paper"
            to="/tags"
          >
            Tags
          </Link>
```

(The footer uses `className="hover:text-paper"`.)

- [ ] **Step 7: Full verification**

Run: `npx tsc && npx jest && npm run build`
Expected: no type errors, all tests PASS, build succeeds

Then, with `npm run dev` and local data:
- A game page shows its tags, and those with ≥10 games are linked.
- `/sitemap.xml` contains `/tags` and `/tags/<slug>` entries.
- The header shows "Tags".

- [ ] **Step 8: Commit**

```bash
git add app/routes/app.\$id.\$slug.tsx app/routes/sitemap[.]xml.tsx app/components/page.tsx app/tests/routes/game-page.spec.tsx
git commit -m "feat: link game tags to market pages; add tags to sitemap and nav"
```

---

## Rollout (after merge)

1. Set `STEAM_API_KEY` in Vercel project env vars.
2. Run a full scrape pass: `cursor=0`, then follow `nextCursor` until it is `0`. Point the existing external scheduler at this loop.
3. Call `/api/compute-stats` once the pass finishes, and schedule it daily after the scrape.
4. Check `/tags` and a few tag pages in production, then submit the sitemap in Search Console.

## Known follow-ups (out of scope)

- **The sitemap will exceed 50,000 URLs** (the protocol limit) once the full Steam catalogue is scraped. It needs splitting into a sitemap index.
- Publisher/developer pages, year pages, comparable games and curated vs pages each get their own spec.
