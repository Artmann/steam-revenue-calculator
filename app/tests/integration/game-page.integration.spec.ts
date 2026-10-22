import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { loader } from '~/routes/app.$id.$slug'
import { loader as redirectLoader } from '~/routes/app.$id._index'

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

  it('fills in defaults for legacy games with null fields.', async () => {
    const games = await getCollection('games')

    await games.insertOne({
      _id: 'game-11' as any,
      gameId: 11,
      slug: 'duelyst-ii-playtest',
      grossRevenue: 0,
      details: {
        id: 11,
        name: 'Duelyst II Playtest',
        categories: null,
        description: null,
        developers: null,
        genres: null,
        metacritic: null,
        numberOfReviews: 0,
        publishers: null,
        price: 0,
        screenshots: null
      } as any
    })

    const result = (await loader({
      request: new Request('http://localhost/app/11/duelyst-ii-playtest'),
      params: { id: '11', slug: 'duelyst-ii-playtest' },
      context: {}
    } as any)) as any

    expect(result.game).toEqual({
      id: 11,
      categories: [],
      description: '',
      developers: [],
      genres: [],
      metacritic: {},
      name: 'Duelyst II Playtest',
      numberOfReviews: 0,
      publishers: [],
      price: 0,
      screenshots: []
    })
  })
})

describe('game id redirect loader (real MongoDB, esix)', () => {
  it('redirects a slug-less game url to the game page.', async () => {
    const games = await getCollection('games')

    await games.insertOne({
      _id: 'game-12' as any,
      gameId: 12,
      slug: 'real-vr-fishing',
      grossRevenue: 0,
      details: { id: 12, name: 'Real VR Fishing' } as any
    })

    const response = (await redirectLoader({
      request: new Request('http://localhost/app/12'),
      params: { id: '12' },
      context: {}
    } as any)) as Response

    expect(response.status).toEqual(301)
    expect(response.headers.get('Location')).toEqual('/app/12/real-vr-fishing')
  })

  it('throws a 404 response for an unknown game.', async () => {
    await expect(
      redirectLoader({
        request: new Request('http://localhost/app/998'),
        params: { id: '998' },
        context: {}
      } as any)
    ).rejects.toMatchObject({ status: 404 })
  })
})
