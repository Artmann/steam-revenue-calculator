import type { StatsQuery } from '../registry'
import { loadGames } from '../utils/games'
import { shareAbove, summarize } from '../utils/stats'

const REVIEW_BOUNDARIES = [
  { label: '0', min: 0, max: 0 },
  { label: '1 – 9', min: 1, max: 9 },
  { label: '10 – 49', min: 10, max: 49 },
  { label: '50 – 99', min: 50, max: 99 },
  { label: '100 – 499', min: 100, max: 499 },
  { label: '500 – 999', min: 500, max: 999 },
  { label: '1,000 – 4,999', min: 1000, max: 4999 },
  { label: '5,000 – 9,999', min: 5000, max: 9999 },
  { label: '10,000 – 49,999', min: 10000, max: 49999 },
  { label: '50,000+', min: 50000, max: Infinity }
]

async function run(): Promise<unknown> {
  const rows = await loadGames()

  const buckets = REVIEW_BOUNDARIES.map((bucket) => {
    const inBucket = rows.filter(
      (row) => row.reviewCount >= bucket.min && row.reviewCount <= bucket.max
    )

    return {
      label: bucket.label,
      minReviews: bucket.min,
      maxReviews: bucket.max === Infinity ? null : bucket.max,
      count: inBucket.length,
      share: rows.length === 0 ? 0 : inBucket.length / rows.length,
      revenue: summarize(inBucket.map((row) => row.revenue))
    }
  })

  const revenues = rows.map((row) => row.revenue)

  return {
    totalGames: rows.length,
    overallRevenue: summarize(revenues),
    overallShareAbove: shareAbove(revenues),
    overallReviews: summarize(rows.map((row) => row.reviewCount)),
    buckets
  }
}

export const reviewDistributionQuery: StatsQuery = {
  name: 'review-distribution',
  description:
    'Distribution of games by review-count bucket, with revenue summaries and the share of games above revenue thresholds.',
  run
}
