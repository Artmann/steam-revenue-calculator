import { randomUUID } from 'node:crypto'
import type { LoaderFunctionArgs } from 'react-router'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { computeMarketStats } from '~/market/stats'
import { loader as gamesLoader } from '~/routes/games'
import { loader as tagLoader } from '~/routes/tags.$slug'

beforeAll(async () => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`

  // 51 pages of 48 at /games, and 25 rows per tag page.
  const games = await getCollection('games')

  await games.insertMany(
    Array.from({ length: 51 * 48 }, (_, index) => ({
      gameId: index + 1,
      slug: `game-${index + 1}`,
      grossRevenue: index + 1,
      tagIds: [1],
      details: { id: index + 1, name: `Game ${index + 1}`, price: 999 }
    }))
  )

  const tags = await getCollection('tags')

  await tags.insertMany([
    {
      tagId: 1,
      name: 'Roguelike',
      slug: 'roguelike',
      gameCount: 51 * 48,
      stats: { ...computeMarketStats([]), gameCount: 51 * 48 }
    },
    {
      tagId: 2,
      name: 'Deckbuilder',
      slug: 'deckbuilder',
      gameCount: 30,
      stats: { ...computeMarketStats([]), gameCount: 30 }
    }
  ])
})

afterAll(async () => {
  await resetDatabaseConnection()
})

function args(url: string, params: Record<string, string> = {}) {
  return {
    context: {},
    params,
    request: new Request(`https://steam-revenue-calculator.com${url}`)
  } as unknown as LoaderFunctionArgs
}

async function status(load: unknown): Promise<number> {
  try {
    await load

    return 200
  } catch (error) {
    if (error instanceof Response) {
      return error.status
    }

    throw error
  }
}

describe('/games pages (real MongoDB)', () => {
  it('shows the last of the 50 pages.', async () => {
    const data = (await gamesLoader(args('/games?page=50'))) as {
      games: { name: string }[]
      page: number
      pageCount: number
    }

    expect({
      firstGame: data.games[0].name,
      page: data.page,
      pageCount: data.pageCount
    }).toEqual({ firstGame: 'Game 96', page: 50, pageCount: 50 })
  })

  it('returns 404 past page 50, though more games exist.', async () => {
    expect(await status(gamesLoader(args('/games?page=51')))).toEqual(404)
  })

  it('returns 404 far past the last game.', async () => {
    expect(await status(gamesLoader(args('/games?page=999999')))).toEqual(404)
  })
})

describe('/tags/:slug pages (real MongoDB)', () => {
  it('shows page 50 of a large tag.', async () => {
    const response = (await tagLoader(
      args('/tags/roguelike?page=50', { slug: 'roguelike' })
    )) as Response
    const data = await response.json()

    expect({
      page: data.topGames.page,
      pageCount: data.topGames.pageCount
    }).toEqual({
      page: 50,
      pageCount: 50
    })
  })

  it('returns 404 past page 50 of a large tag.', async () => {
    expect(
      await status(
        tagLoader(args('/tags/roguelike?page=51', { slug: 'roguelike' }))
      )
    ).toEqual(404)
  })

  it('returns 404 past the last page of a small tag.', async () => {
    expect(
      await status(
        tagLoader(args('/tags/deckbuilder?page=3', { slug: 'deckbuilder' }))
      )
    ).toEqual(404)
  })
})
