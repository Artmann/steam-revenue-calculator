import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { loader } from '~/routes/app.$id.$slug'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

describe('game page loader (real MongoDB, esix)', () => {
  it('returns the game details found by esix and its tags.', async () => {
    const games = await getCollection('games')
    const tags = await getCollection('tags')

    await tags.insertOne({ tagId: 19, name: 'Action', slug: 'action', gameCount: 12, stats: {} })
    await games.insertOne({
      _id: 'game-10' as any,
      gameId: 10,
      slug: 'counter-strike',
      grossRevenue: 1000,
      tagIds: [19],
      details: {
        id: 10,
        name: 'Counter-Strike',
        categories: [],
        description: 'Classic.',
        developers: ['Valve'],
        genres: [],
        metacritic: {},
        numberOfReviews: 1000,
        publishers: ['Valve'],
        price: 999,
        screenshots: []
      }
    })

    const result = (await loader({
      request: new Request('http://localhost/app/10/counter-strike'),
      params: { id: '10', slug: 'counter-strike' },
      context: {}
    } as any)) as any

    expect(result.game.name).toBe('Counter-Strike')
    expect(result.tags.map(({ slug }: { slug: string }) => slug)).toEqual(['action'])
  })

  it('throws a 404 response for an unknown game.', async () => {
    await expect(
      loader({
        request: new Request('http://localhost/app/999/nope'),
        params: { id: '999', slug: 'nope' },
        context: {}
      } as any)
    ).rejects.toMatchObject({ status: 404 })
  })
})
