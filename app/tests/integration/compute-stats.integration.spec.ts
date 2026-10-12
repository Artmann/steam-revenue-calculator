import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { loader } from '~/routes/api.compute-stats'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

describe('compute-stats loader (real MongoDB)', () => {
  it('writes the baseline and stats for tags with enough games.', async () => {
    process.env.SCRAPE_KEY = 'test-key'

    const games = await getCollection('games')
    const tags = await getCollection('tags')

    await tags.insertMany([
      { tagId: 19, name: 'Action', slug: 'action', gameCount: 0 },
      { tagId: 492, name: 'Indie', slug: 'indie', gameCount: 0 }
    ])
    await games.insertMany(
      Array.from({ length: 12 }, (_, index) => ({
        gameId: index + 1,
        slug: `game-${index + 1}`,
        grossRevenue: 1000 * (index + 1),
        basePrice: 999,
        releaseYear: 2020,
        reviewCount: 10 * (index + 1),
        tagIds: index < 3 ? [19, 492] : [19],
        details: { name: `Game ${index + 1}`, developers: [], publishers: [] }
      }))
    )

    const response = (await loader({
      request: new Request('http://localhost/api/compute-stats?key=test-key'),
      params: {},
      context: {}
    } as any)) as Response

    expect(await response.json()).toEqual({ games: 12, tags: 2, tagsWithStats: 1 })

    const action = await tags.findOne({ tagId: 19 })
    const indie = await tags.findOne({ tagId: 492 })
    const baseline = await (await getCollection('marketStats')).findOne({ _id: 'all' as any })

    expect(action?.gameCount).toBe(12)
    expect(action?.stats).toBeDefined()
    expect(indie?.gameCount).toBe(3)
    expect(indie?.stats).toBeUndefined()
    expect(baseline?.stats).toBeDefined()
  })
})
