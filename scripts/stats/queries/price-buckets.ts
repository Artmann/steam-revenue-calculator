import type { StatsQuery } from '../registry'
import { loadGames, loadTags, type GameRow } from '../utils/games'
import { median, shareAbove, summarize } from '../utils/stats'

// Base price in cents, inclusive bounds.
const PRICE_BOUNDARIES = [
  { label: '$0.01 – $0.99', min: 1, max: 99 },
  { label: '$1.00 – $2.99', min: 100, max: 299 },
  { label: '$3.00 – $4.99', min: 300, max: 499 },
  { label: '$5.00 – $9.99', min: 500, max: 999 },
  { label: '$10.00 – $14.99', min: 1000, max: 1499 },
  { label: '$15.00 – $19.99', min: 1500, max: 1999 },
  { label: '$20.00 – $24.99', min: 2000, max: 2499 },
  { label: '$25.00 – $29.99', min: 2500, max: 2999 },
  { label: '$30.00 – $39.99', min: 3000, max: 3999 },
  { label: '$40.00 – $59.99', min: 4000, max: 5999 },
  { label: '$60.00 – $99.99', min: 6000, max: 9999 },
  { label: '$100.00+', min: 10000, max: Infinity }
]

// Steam tag names to facet by. Names missing from the tags collection are skipped.
const TAG_NAMES = [
  'Action',
  'Adventure',
  'Casual',
  'RPG',
  'Simulation',
  'Strategy',
  'Puzzle',
  'Platformer',
  'Roguelike',
  'Roguelite',
  'Metroidvania',
  'Visual Novel',
  'Horror',
  'Survival',
  'Cozy',
  'Deckbuilding',
  'City Builder',
  'Colony Sim'
]

const RECENT_SINCE_YEAR = 2020

function bucketStats(rows: GameRow[], bucket: (typeof PRICE_BOUNDARIES)[number]) {
  const inBucket = rows.filter(
    (row) => row.basePrice >= bucket.min && row.basePrice <= bucket.max
  )
  const revenues = inBucket.map((row) => row.revenue)

  return {
    label: bucket.label,
    minCents: bucket.min,
    maxCents: bucket.max === Infinity ? null : bucket.max,
    count: inBucket.length,
    revenue: summarize(revenues),
    shareAbove: shareAbove(revenues),
    medianReviews: median(inBucket.map((row) => row.reviewCount))
  }
}

function priceBreakdown(rows: GameRow[]) {
  const revenues = rows.map((row) => row.revenue)

  return {
    count: rows.length,
    revenue: summarize(revenues),
    shareAbove: shareAbove(revenues),
    buckets: PRICE_BOUNDARIES.map((bucket) => bucketStats(rows, bucket))
  }
}

async function run(): Promise<unknown> {
  const [rows, tags] = await Promise.all([loadGames(), loadTags()])

  const recent = rows.filter(
    (row) => row.releaseYear !== undefined && row.releaseYear >= RECENT_SINCE_YEAR
  )

  const byTag = TAG_NAMES.flatMap((name) => {
    const tag = tags.find((candidate) => candidate.name === name)

    if (!tag) {
      console.warn(`  skipping unknown tag: ${name}`)
      return []
    }

    const tagRows = rows.filter((row) => row.tagIds.includes(tag.tagId))
    const recentTagRows = recent.filter((row) => row.tagIds.includes(tag.tagId))

    return [
      {
        ...tag,
        all: priceBreakdown(tagRows),
        recent: priceBreakdown(recentTagRows)
      }
    ]
  })

  return {
    recentSinceYear: RECENT_SINCE_YEAR,
    all: priceBreakdown(rows),
    recent: priceBreakdown(recent),
    byTag
  }
}

export const priceBucketsQuery: StatsQuery = {
  name: 'price-buckets',
  description:
    'Revenue by base price bucket for all games and games released since 2020, overall and per Steam tag.',
  run
}
