import { getCollection } from '~/db'
import type { GameDetails } from '~/games';

interface GameRecord {
  details?: GameDetails
  tagIds?: number[]
}

let cachedGameCount: number | null = null

export class GameService {
  async findGame(gameId: number): Promise<GameRecord | null> {
    const collection = await getCollection('games')

    return collection.findOne<GameRecord>(
      { gameId },
      { projection: { _id: 0, details: 1, tagIds: 1 } }
    )
  }

  async listGames(page: number, pageSize: number): Promise<(GameDetails & { grossRevenue: number })[]> {
    const collection = await getCollection('games')

    const skip = Math.max(page - 1, 0) * pageSize
    const limit = pageSize

    const games = (await collection
      .find({})
      .sort({ grossRevenue: -1 })
      .project({
        _id: 0,
        grossRevenue: 1,
        'details.id': 1,
        'details.name': 1,
        'details.price': 1
      })
      .skip(skip)
      .limit(limit)
      .toArray()) as { grossRevenue: number; details: GameDetails }[]

    return games.map((game) => ({ ...game.details, grossRevenue: game.grossRevenue }))
  }

  async getGameCount(): Promise<number> {
    if (cachedGameCount !== null) {
      return cachedGameCount
    }

    const collection = await getCollection('games')
    const count = (await collection.estimatedDocumentCount()) as number
    cachedGameCount = count

    return count
  }

  async listPopularGames(): Promise<GameDetails[]> {
    const popularGameIds = [
      367520, 1817230, 1145360, 973230, 391540, 207610, 1766740, 72850, 105600,
      1332010, 2230760, 646570, 567380, 1942280, 1708091, 379430, 488821, 322170
    ]

    const collection = await getCollection('games')

    const games = (await collection
      .find({ gameId: { $in: popularGameIds } })
      .project({ _id: 0, details: 1 })
      .toArray()) as { details: GameDetails }[]

    return games.map((game) => game.details)
  }
}
