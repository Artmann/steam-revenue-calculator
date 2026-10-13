import { getCollection } from '../utils/db'
import type { StatsQuery } from '../registry'
import { summarize } from '../utils/stats'

interface Row {
  reviews: number
  revenue: number
}

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
  const collection = await getCollection('games')

  const cursor = collection
    .find({
      'details.numberOfReviews': { $exists: true },
      grossRevenue: { $gte: 0 }
    })
    .project({
      _id: 0,
      grossRevenue: 1,
      'details.numberOfReviews': 1
    })

  const rows: Row[] = []
  await cursor.forEach((doc: any) => {
    const reviews = doc?.details?.numberOfReviews
    if (typeof reviews !== 'number') {
      return
    }
    rows.push({
      reviews,
      revenue: doc.grossRevenue ?? 0
    })
  })

  const buckets = REVIEW_BOUNDARIES.map((bucket) => {
    const inBucket = rows.filter(
      (row) => row.reviews >= bucket.min && row.reviews <= bucket.max
    )
    return {
      label: bucket.label,
      minReviews: bucket.min,
      maxReviews: bucket.max === Infinity ? null : bucket.max,
      revenue: summarize(inBucket.map((row) => row.revenue))
    }
  })

  const overallRevenue = summarize(rows.map((row) => row.revenue))
  const overallReviews = summarize(rows.map((row) => row.reviews))

  return {
    totalGames: rows.length,
    overallRevenue,
    overallReviews,
    buckets
  }
}

export const reviewDistributionQuery: StatsQuery = {
  name: 'review-distribution',
  description:
    'Distribution of games by review-count bucket, with revenue summaries and overall mean-vs-median stats.',
  run
}
