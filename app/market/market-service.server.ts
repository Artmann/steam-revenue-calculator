import { getCollection } from '~/db'
import {
  MARKET_GAME_PROJECTION,
  toMarketGame,
  type MarketGameDocument
} from '~/market/market-game'
import type {
  MarketGame,
  MarketStats,
  TagFrequencies,
  TopGame
} from '~/market/stats'
import type { TagSummary } from '~/market/tag-summaries'

// Stops a query in MongoDB too, unlike giving up on it in the function. Pages
// use this; the scraper's stats run needs as long as it takes.
export const pageQueryLimitMs = 6_000

export async function loadMarketGames(
  query: Record<string, unknown>,
  maxTimeMS?: number
): Promise<MarketGame[]> {
  const collection = await getCollection('games')

  // This is MongoDB's Collection.find, which returns a cursor, not Array.find.
  // react-doctor-disable-next-line react-doctor/no-array-find-result-member-access-without-guard
  const documents = (await collection
    .find(query, { maxTimeMS })
    .project(MARKET_GAME_PROJECTION)
    .toArray()) as MarketGameDocument[]

  return documents.map(toMarketGame)
}

export async function loadTopGames(
  query: Record<string, unknown>,
  page: number,
  pageSize: number
): Promise<TopGame[]> {
  const collection = await getCollection('games')

  // This is MongoDB's Collection.find, which returns a cursor, not Array.find.
  // react-doctor-disable-next-line react-doctor/no-array-find-result-member-access-without-guard
  const documents = (await collection
    .find(query)
    .sort({ grossRevenue: -1, gameId: 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .project({ _id: 0, gameId: 1, slug: 1, grossRevenue: 1, 'details.name': 1 })
    .toArray()) as MarketGameDocument[]

  return documents.map(({ gameId, slug, grossRevenue, details }) => ({
    gameId,
    name: details?.name ?? '',
    slug,
    grossRevenue
  }))
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
