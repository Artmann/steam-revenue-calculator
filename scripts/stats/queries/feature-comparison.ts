import { getCollection } from '../utils/db'
import type { StatsQuery } from '../registry'
import { summarize } from '../utils/stats'

interface Row {
  revenue: number
  categories: string[]
  primaryGenre: string | null
}

const FEATURES = [
  'Steam Workshop',
  'Multi-player',
  'Single-player',
  'Co-op',
  'Includes level editor',
  'Early Access',
  'Steam Achievements',
  'Full controller support'
]

const TOP_GENRE_COUNT = 6

async function run(): Promise<unknown> {
  const collection = await getCollection('games')

  const cursor = collection
    .find({
      'details.categories': { $exists: true },
      grossRevenue: { $gte: 0 }
    })
    .project({
      _id: 0,
      grossRevenue: 1,
      'details.categories': 1,
      'details.genres': 1
    })

  const rows: Row[] = []
  await cursor.forEach((doc: any) => {
    const categories = doc?.details?.categories
    if (!Array.isArray(categories)) {
      return
    }
    rows.push({
      revenue: doc.grossRevenue ?? 0,
      categories,
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

  const features = FEATURES.map((feature) => {
    const withFeature = rows.filter((row) => row.categories.includes(feature))
    const withoutFeature = rows.filter((row) => !row.categories.includes(feature))

    const byGenre = topGenres.map((genre) => {
      const genreRows = rows.filter((row) => row.primaryGenre === genre)
      const withInGenre = genreRows.filter((row) => row.categories.includes(feature))
      const withoutInGenre = genreRows.filter(
        (row) => !row.categories.includes(feature)
      )
      return {
        genre,
        with: summarize(withInGenre.map((row) => row.revenue)),
        without: summarize(withoutInGenre.map((row) => row.revenue))
      }
    })

    return {
      feature,
      with: summarize(withFeature.map((row) => row.revenue)),
      without: summarize(withoutFeature.map((row) => row.revenue)),
      byGenre
    }
  })

  return {
    totalGames: rows.length,
    topGenres,
    features
  }
}

export const featureComparisonQuery: StatsQuery = {
  name: 'feature-comparison',
  description:
    'Revenue comparisons for games with vs. without specific categories (Workshop, multiplayer, etc.), including per-genre splits.',
  run
}
