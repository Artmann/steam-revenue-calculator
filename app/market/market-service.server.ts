import { getCollection } from '~/db'
import {
  MARKET_GAME_PROJECTION,
  toMarketGame,
  type MarketGameDocument
} from '~/market/market-game'
import type { MarketGame, MarketStats, TagFrequencies } from '~/market/stats'
import type { TagSummary } from '~/market/tag-summaries'

export async function loadMarketGames(
  query: Record<string, unknown>
): Promise<MarketGame[]> {
  const collection = await getCollection('games')

  const documents = (await collection
    .find(query)
    .project(MARKET_GAME_PROJECTION)
    .toArray()) as MarketGameDocument[]

  return documents.map(toMarketGame)
}

export interface TagRecord {
  tagId: number
  name: string
  slug: string
  gameCount: number
  stats?: MarketStats
  statsUpdatedAt?: Date
}

export interface TagIndexEntry {
  tagId: number
  name: string
  slug: string
  hasPage: boolean
}

export interface Baseline {
  stats: MarketStats
  tagFrequencies: TagFrequencies
  updatedAt: Date
}

const tagIndexTtlMs = 10 * 60 * 1000

let tagIndexCache: { entries: TagIndexEntry[]; expiresAt: number } | undefined

export async function getTagIndex(): Promise<TagIndexEntry[]> {
  if (tagIndexCache && tagIndexCache.expiresAt > Date.now()) {
    return tagIndexCache.entries
  }

  const collection = await getCollection('tags')

  const documents = (await collection
    .find({})
    .project({ _id: 0, tagId: 1, name: 1, slug: 1, 'stats.gameCount': 1 })
    .toArray()) as { tagId: number; name: string; slug: string; stats?: object }[]

  const entries = documents
    .map(({ tagId, name, slug, stats }) => ({
      tagId,
      name,
      slug,
      hasPage: Boolean(stats)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  tagIndexCache = { entries, expiresAt: Date.now() + tagIndexTtlMs }

  return entries
}

export async function getTagBySlug(slug: string): Promise<TagRecord | null> {
  const collection = await getCollection('tags')

  return (await collection.findOne(
    { slug },
    { projection: { _id: 0 } }
  )) as TagRecord | null
}

export async function getBaseline(): Promise<Baseline | null> {
  const collection = await getCollection('marketStats')

  return (await collection.findOne(
    { _id: 'all' as any },
    { projection: { _id: 0 } }
  )) as Baseline | null
}

export async function listTagSummaries(): Promise<TagSummary[]> {
  const collection = await getCollection('tags')

  const documents = (await collection
    .find({ stats: { $exists: true } })
    .project({
      _id: 0,
      name: 1,
      slug: 1,
      gameCount: 1,
      'stats.percentiles.p50': 1,
      'stats.shareAbove.hundredThousand': 1
    })
    .toArray()) as {
    name: string
    slug: string
    gameCount: number
    stats: {
      percentiles: { p50: number }
      shareAbove: { hundredThousand: number }
    }
  }[]

  return documents.map(({ name, slug, gameCount, stats }) => ({
    name,
    slug,
    gameCount,
    median: stats.percentiles.p50,
    shareAboveHundredThousand: stats.shareAbove.hundredThousand
  }))
}
