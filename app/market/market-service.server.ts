import { getCollection } from '~/db'
import {
  MARKET_GAME_PROJECTION,
  toMarketGame,
  type MarketGameDocument
} from '~/market/market-game'
import type { MarketGame } from '~/market/stats'

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
