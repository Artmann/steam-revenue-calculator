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
