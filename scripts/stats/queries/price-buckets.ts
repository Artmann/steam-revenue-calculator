import { getCollection } from '../utils/db'
import type { StatsQuery } from '../registry'
import { summarize } from '../utils/stats'

interface Row {
  price: number
  reviews: number
  revenue: number
  primaryGenre: string | null
}

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

const TOP_GENRE_COUNT = 6
const EARNER_REVIEW_FLOOR = 100

function bucketFor(priceInCents: number): (typeof PRICE_BOUNDARIES)[number] | undefined {
  return PRICE_BOUNDARIES.find(
    (bucket) => priceInCents >= bucket.min && priceInCents <= bucket.max
  )
}

function bucketStats(rows: Row[], bucket: typeof PRICE_BOUNDARIES[number]) {
  const inBucket = rows.filter(
    (row) => row.price >= bucket.min && row.price <= bucket.max
  )
  const earners = inBucket.filter((row) => row.reviews >= EARNER_REVIEW_FLOOR)
  return {
    label: bucket.label,
    minCents: bucket.min,
    maxCents: bucket.max === Infinity ? null : bucket.max,
    allGames: {
      count: inBucket.length,
      earnerCount: earners.length,
      earnerShare: inBucket.length === 0 ? 0 : earners.length / inBucket.length,
      revenue: summarize(inBucket.map((row) => row.revenue)),
      reviews: summarize(inBucket.map((row) => row.reviews))
    },
    earners: {
      revenue: summarize(earners.map((row) => row.revenue)),
      reviews: summarize(earners.map((row) => row.reviews))
    }
  }
}

async function run(): Promise<unknown> {
  const collection = await getCollection('games')

  const cursor = collection
    .find({
      'details.price': { $gt: 0 },
      grossRevenue: { $gte: 0 }
    })
    .project({
      _id: 0,
      grossRevenue: 1,
      'details.price': 1,
      'details.numberOfReviews': 1,
      'details.genres': 1
    })

  const rows: Row[] = []
  await cursor.forEach((doc: any) => {
    const price = doc?.details?.price
    const reviews = doc?.details?.numberOfReviews
    if (typeof price !== 'number' || typeof reviews !== 'number') {
      return
    }
    rows.push({
      price,
      reviews,
      revenue: doc.grossRevenue ?? 0,
      primaryGenre: doc?.details?.genres?.[0] ?? null
    })
  })

  const genreCounts = new Map<string, number>()
  for (const row of rows) {
    if (!row.primaryGenre) { continue }
    genreCounts.set(row.primaryGenre, (genreCounts.get(row.primaryGenre) ?? 0) + 1)
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_GENRE_COUNT)
    .map(([genre]) => genre)

  const overallBuckets = PRICE_BOUNDARIES.map((bucket) => bucketStats(rows, bucket))

  const byGenre = topGenres.map((genre) => {
    const genreRows = rows.filter((row) => row.primaryGenre === genre)
    const buckets = PRICE_BOUNDARIES.map((bucket) => bucketStats(genreRows, bucket))
    return { genre, totalGames: genreRows.length, buckets }
  })

  const allEarners = rows.filter((row) => row.reviews >= EARNER_REVIEW_FLOOR)

  return {
    totalGames: rows.length,
    earnerCount: allEarners.length,
    earnerShare: rows.length === 0 ? 0 : allEarners.length / rows.length,
    earnerReviewFloor: EARNER_REVIEW_FLOOR,
    overall: overallBuckets,
    byGenre
  }
}

export const priceBucketsQuery: StatsQuery = {
  name: 'price-buckets',
  description:
    'Median/mean revenue and review counts by price bucket, overall and faceted by top genres.',
  run
}
