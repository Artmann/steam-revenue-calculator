import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { loadTopGames } from '~/market/market-service.server'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

describe('loadTopGames (real MongoDB)', () => {
  it('pages through the matching games by revenue.', async () => {
    const games = await getCollection('games')

    await games.insertMany(
      Array.from({ length: 7 }, (_, index) => ({
        gameId: index + 1,
        slug: `game-${index + 1}`,
        grossRevenue: 1000 * (index + 1),
        tagIds: index === 6 ? [2] : [1],
        details: { name: `Game ${index + 1}` }
      }))
    )

    const query = { tagIds: { $all: [1] } }

    expect(
      (await loadTopGames(query, 1, 4)).map(({ gameId }) => gameId)
    ).toEqual([6, 5, 4, 3])
    expect(await loadTopGames(query, 2, 4)).toEqual([
      { gameId: 2, name: 'Game 2', slug: 'game-2', grossRevenue: 2000 },
      { gameId: 1, name: 'Game 1', slug: 'game-1', grossRevenue: 1000 }
    ])
  })
})
