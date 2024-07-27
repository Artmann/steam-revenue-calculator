//@ts-ignore
import { MongoClient } from 'mongodb'

import { createGameSlug, fetchGames, GameDetails } from '~/games'
import { Game } from '~/models/game'
import { calculateRevenue } from '~/revenue'

export class GameService {
  async listGames(page: number, pageSize: number): Promise<GameDetails[]> {
    // Use a raw db query because Esix doesn't support skip.
    const url = process.env.DB_URL ?? 'mongodb://127.0.0.1:27017/'
    const poolSize = parseInt(process.env.DB_POOL_SIZE ?? '10', 10)
    const databaseName = process.env.DB_DATABASE ?? ''

    const client = await MongoClient.connect(url, {
      poolSize,
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    const database = await client.db(databaseName)
    const collection = await database.collection<Game>('games')

    const skip = Math.max(page - 1, 0) * pageSize
    const limit = pageSize

    const games = (await collection
      .find({})
      .sort({ grossRevenue: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()) as Game[]

    const details = games.map((game) => game.details) as GameDetails[]

    return details
  }

  async listPopularGames(): Promise<GameDetails[]> {
    const popularGameIds = [
      367520, 1817230, 1145360, 973230, 391540, 207610, 1766740, 72850, 105600,
      1332010, 2230760, 646570, 567380, 1942280, 1708091, 379430, 488821, 322170
    ]

    const games = await Game.whereIn('gameId', popularGameIds).get()

    return games.map((game) => game.details) as GameDetails[]
  }

  async migrateGamesToDatabase(): Promise<void> {
    const games = await fetchGames()

    console.log(`Migrating ${games.length} games to the database.`)

    let counter = 0

    for (const game of games) {
      const existingGame = await Game.findBy('gameId', game.id)

      if (existingGame) {
        existingGame.details = game
        await existingGame.save()
      } else {
        const slug = createGameSlug(game.name)
        const grossRevenue = calculateRevenue(
          game.numberOfReviews,
          game.price / 100
        )

        await Game.create({
          details: game,
          gameId: game.id,
          grossRevenue,
          slug
        })
      }

      if (counter % 1000 === 0) {
        console.log(`Migrated ${counter} games.`)
      }

      counter += 1
    }
  }
}
