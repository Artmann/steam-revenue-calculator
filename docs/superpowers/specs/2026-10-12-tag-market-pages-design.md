# Tag market pages: design

Date: 2026-10-12
Status: Draft, awaiting review

## Goal

Make the site the place indie developers go to size a market before building a game
("how much do roguelikes make on Steam?"). Organic search traffic should follow from
pages that are genuinely useful, not from page count.

This is the first of several page families built from the same data. Publisher and
developer pages, release-year pages, comparable games ("games like X") and curated
X-vs-Y pages are out of scope and get their own specs later.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Primary goal | Usefulness for developers first; SEO follows | Deep pages rank and retain better than thin ones |
| Tag source | Steam `IStoreBrowseService/GetItems` + `IStoreService/GetTagList` | Batched, official (undocumented), also returns release date, review count, % positive and price. Verified by probe on 2026-10-12. SteamSpy is the fallback if it breaks. |
| Genres | Folded into tags | Steam's genres exist as tags with the same names; one model, one template |
| Interactivity | One tag page with URL filters; only the unfiltered page is indexed | Developers get the slice they need without a second tool |
| Computation | Precompute per-tag stats daily; filtered views computed live with the same function | Heavy work is batch, filters stay dynamic, one code path for the maths |

## 1. Data model and scraper

### `games` collection: new top-level fields

`details` stays unchanged so the existing game page keeps working.

| Field | Source (`GetItems`) | Notes |
|---|---|---|
| `tagIds: number[]` | `tags[]`, top 20 ordered by weight | Multikey index |
| `releaseDate: Date` | `release.original_steam_release_date` (fallback `steam_release_date`) | Unix seconds → Date |
| `releaseYear: number` | derived from `releaseDate` | Index |
| `reviewCount: number` | `reviews.summary_filtered.review_count` | Replaces `recommendations.total` as revenue input |
| `percentPositive: number` | `reviews.summary_filtered.percent_positive` | |
| `price: number` (cents) | `best_purchase_option.final_price_in_cents` | Current price, may be discounted |
| `basePrice: number` (cents) | `best_purchase_option` undiscounted price; equals `price` when not discounted | Revenue input |

`grossRevenue` is recomputed as `calculateRevenue(reviewCount, basePrice / 100)`. This changes
the numbers people see across the site; most will rise because review counts usually exceed
recommendation counts. This is intentional.

Indexes to add: `tagIds:1`, `releaseYear:1`, `basePrice:1`. Remove the unused top-level
`name:1` index; the name lives at `details.name`. The sitemap's `sort({ name: 1 })` should use
`details.name`.

### New `tags` collection

```ts
{
  tagId: number        // unique index
  name: string         // from GetTagList
  slug: string         // slugify(name, { lower: true }); unique index
  gameCount: number
  stats?: MarketStats  // set only when gameCount >= 10
  statsUpdatedAt?: Date
}
```

There is also one baseline document holding stats across all games. It lives in a small
`marketStats` collection with `_id: 'all'`, so it can't be confused with a tag.

On a slug collision between two tag names, append the tag ID to the later one's slug.

### Scraper

- Replace the per-game `appdetails` call with batched `GetItems` calls
  (`include_tag_count: 20, include_release, include_reviews, include_basic_info`).
- Fix the cursor bug in `app/routes/api.scrape-games.ts`: the cursor advances by
  `batchSize` while the slice starts at `cursor * batchSize`, which skips games.
- Keep skipping free games and IDs in `data/ignored.json`.
- If `GetItems` does not return screenshots, description or metacritic data, keep
  `appdetails` for those fields only.
- Sync the `tags` collection (`tagId`, `name`, `slug`) from `GetTagList` once per run.
- Add `GET /api/backfill?key=…&cursor=N` to fill the new fields for games already in the
  database, in `GetItems` batches. Like the scraper, it is cursor-based so each call stays
  within the Vercel function timeout.

To verify during planning:
- The maximum number of IDs per `GetItems` request.
- The exact field holding the undiscounted price in `best_purchase_option`.
- Whether `GetItems` can return screenshots.

## 2. Stats computation

### `app/market/stats.ts`: pure, no I/O

```ts
type MarketGame = {
  gameId: number; name: string; slug: string
  grossRevenue: number; basePrice: number; releaseYear?: number
  tagIds: number[]; reviewCount: number
  developers: string[]; publishers: string[]
}

computeMarketStats(games: MarketGame[], baseline?: TagFrequencies): MarketStats
```

`MarketStats` contains:
- `gameCount`, `totalRevenue`, `meanRevenue`
- `percentiles`: p10, p25, p50, p75, p90 of `grossRevenue`
- `shareAbove`: share of games with revenue ≥ $1k, $10k, $100k, $1M
- `distribution`: counts in log buckets: <$1k, $1k–10k, $10k–100k, $100k–1M, $1M–10M, ≥$10M
- `priceBands`: <$5, $5–10, $10–15, $15–20, $20–30, ≥$30; each `{ count, median }`
- `byYear`: `{ year, count, median }[]` ascending; games with no year are excluded
- `topGames`: top 25 by revenue `{ gameId, name, slug, grossRevenue }`
- `topDevelopers`, `topPublishers`: top 10 by summed revenue `{ name, gameCount, revenue }`
- `relatedTags`: `{ tagId, count, lift }[]`, top 12. `lift` is the share of games in the set
  with the tag divided by the share of all games with it. Only tags present in at least 5
  games of the set qualify. Sorted by `count * log(lift)` with `lift > 1`, so generic tags
  sink. The tag(s) defining the set are excluded.

`tagFrequencies(games)` returns the baseline share per tag ID that `lift` needs. It is computed
during the precompute run and stored with the all-games baseline.

### Precompute job: `GET /api/compute-stats?key=…`

1. Load all games, fetching only the `MarketGame` fields.
2. Compute baseline tag frequencies and all-games stats; store as the baseline document.
3. Group games by tag ID. For each tag set `gameCount`; when `gameCount >= 10`, compute
   and store `stats` and `statsUpdatedAt`; otherwise unset `stats`.
4. Bulk-write to `tags`.

It runs daily, triggered by the existing external scheduler after the scrape. It uses the same
`SCRAPE_KEY` check as the scrape endpoint.

### Live filtered views

Filter params on the tag page:
- `price=10-20`: dollars, either end optional
- `since=2021`, `until=2024`: release year
- `with=deckbuilder,turn-based`: additional tag slugs, all must match

The loader resolves slugs to IDs and queries
`{ tagIds: { $all: [tagId, ...withIds] }, basePrice: {$gte,$lte}, releaseYear: {$gte,$lte} }`
with the `MarketGame` projection. It then calls `computeMarketStats` with the stored baseline
frequencies.

Invalid params are ignored. Unknown `with` slugs are dropped and listed in a small notice.

Below 5 matching games the page shows the game list but hides percentiles, distribution,
bands and trend, with a "not enough games for reliable stats" note.

## 3. Pages and SEO

### `/tags` (`app/routes/tags._index.tsx`)

A table of tags with precomputed stats: name (links to the tag page), game count, median
revenue, and share ≥ $100k. It is sortable with `?sort=median|count|share`, default median.
Rows come from the precomputed `tags` collection, so there are no heavy queries.

### `/tags/:slug` (`app/routes/tags.$slug.tsx`)

- 404 if the slug is unknown or the tag has no `stats`, i.e. fewer than 10 games.
- Title: "How much do {Name} games make on Steam?"; shows a "data as of {statsUpdatedAt}" date.
- Sections in order:
  1. Headline figures vs the all-Steam baseline
  2. Filter form (GET, works without JS)
  3. Distribution chart
  4. Price bands
  5. Trend by release year
  6. Top games (link to `/app/:id/:slug`)
  7. Top developers and publishers (plain text for now)
  8. Related tags (links)
- Charts are hand-rolled SVG/CSS in the existing editorial style. No chart library.

### SEO and caching

- Canonical is always `/tags/:slug`. Filtered views get `<meta name="robots" content="noindex, follow">`.
- Cache-Control:
  - Canonical tag pages and `/tags`: `s-maxage=86400, stale-while-revalidate=604800`
  - Filtered views: `s-maxage=3600, stale-while-revalidate=86400`
- Sitemap: add `/tags` and every tag with `stats`.
- Game page (`app/routes/app.$id.$slug.tsx`): list the game's tags as links to their tag
  pages. Tags with fewer than 10 games show as plain text.
- Header: add a "Tags" nav link.

## Rollout order

1. Data model, indexes, and `GetItems` client
2. Scraper changes and cursor fix
3. `computeMarketStats`
4. `/api/compute-stats`
5. Backfill
6. `/tags/:slug`, then `/tags`
7. Game-page tag links, sitemap, nav

Steps 1–5 can ship before any page exists; the new fields are additive.

## Error handling

- `GetItems` failure or HTTP 429: back off and retry, as the scraper does today. On repeated
  failure the batch is skipped and the cursor still advances, so one bad batch can't stall
  the run.
- Items with `success != 1` or no `best_purchase_option` are skipped, as free or unlisted games.
- The compute job writes per tag. A crash midway leaves earlier tags updated and later ones
  stale; `statsUpdatedAt` makes that visible.
- The tag page tolerates a missing baseline by hiding the comparison figures.

## Testing

- `computeMarketStats`: unit tests with small fixed datasets covering:
  - percentiles, including even/odd counts and one game
  - bucket edges
  - price-band edges
  - games with no year
  - top-N ordering and ties
  - lift filtering, so a generic tag is excluded
- Filter parsing: valid and invalid `price`, `since` and `until`, unknown `with` slugs.
- `GetItems` response mapping: a recorded fixture (the Hades/Slay the Spire probe) → expected
  game fields, including the discounted vs base price case.
- Revenue: the existing `calculate-revenue.spec.ts` stays green; add a case asserting that
  `basePrice` is used.
