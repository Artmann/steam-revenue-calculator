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
