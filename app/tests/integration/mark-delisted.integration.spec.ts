import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { markDelisted } from '~/scrape/mark-delisted'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

beforeEach(async () => {
  await (await getCollection('games')).deleteMany({})
})

async function seedGames(listed: number, unlisted: number, runStartedAt: number) {
  const games = await getCollection('games')

  await games.insertMany([
    ...Array.from({ length: listed }, (_, index) => ({
      gameId: index + 1,
      details: { name: `Listed ${index + 1}` },
      listedAt: runStartedAt
    })),
    ...Array.from({ length: unlisted }, (_, index) => ({
      gameId: 10_000 + index,
      details: { name: `Gone ${index}` },
      listedAt: 1
    }))
  ])
}

describe('markDelisted (real MongoDB)', () => {
  it('flags only games this run did not list, leaving their data intact.', async () => {
    await seedGames(95, 5, 500)

    expect(await markDelisted(500, 95)).toEqual({ count: 5 })

    const games = await getCollection('games')
    const gone = await games.findOne({ gameId: 10_000 })

    expect(gone).toMatchObject({ delistedAt: 500, details: { name: 'Gone 0' } })
    expect(await games.countDocuments({ delistedAt: { $exists: true } })).toBe(5)
  })

  it('keeps the original delisting time for games already flagged.', async () => {
    const games = await getCollection('games')

    await games.insertOne({ gameId: 1, listedAt: 1, delistedAt: 42 })

    expect(await markDelisted(500, 1)).toEqual({ count: 0 })
    expect((await games.findOne({ gameId: 1 }))?.delistedAt).toBe(42)
  })

  it('skips flagging when the list looks truncated.', async () => {
    await seedGames(50, 50, 500)

    expect(await markDelisted(500, 50)).toEqual({
      skipped: true,
      listed: 50,
      active: 100
    })

    const games = await getCollection('games')

    expect(await games.countDocuments({ delistedAt: { $exists: true } })).toBe(0)
  })
})
