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
