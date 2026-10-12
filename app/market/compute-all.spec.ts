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

  it('excludes the tag itself from its related tags.', () => {
    const tag1 = result.tags.find(({ tagId }) => tagId === 1)

    expect(tag1?.stats?.relatedTags.map(({ tagId }) => tagId)).toEqual([3])
  })
})
