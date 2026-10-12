import { ObjectId } from 'mongodb'

import { getCollection } from '~/db'
import type { ChunkResult } from '~/scrape/run-record'
import { buildGameUpsert } from '~/steam/build-game-upsert'
import { mapStoreItem, type ScrapedGame } from '~/steam/map-store-item'
import { fetchStoreItems } from '~/steam/store-api'

export async function scrapeIds(
  appIds: number[],
  runStartedAt: number
): Promise<ChunkResult> {
  const { items, failedIds } = await fetchStoreItems(appIds)

  const games = items
    .map(mapStoreItem)
    .filter((game): game is ScrapedGame => Boolean(game))

  if (games.length > 0) {
    const collection = await getCollection('games')
    const now = Date.now()

    await collection.bulkWrite(
      games.map((game) =>
        buildGameUpsert(game, now, new ObjectId().toHexString(), runStartedAt)
      ),
      { ordered: false }
    )
  }

  return { saved: games.length, failedIds }
}
