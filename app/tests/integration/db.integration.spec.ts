import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

describe('getCollection (real MongoDB)', () => {
  it('creates the expected indexes on a fresh database.', async () => {
    const games = await getCollection('games')
    const tags = await getCollection('tags')

    const gameIndexes = (await games.indexes()).map(({ name }) => name)
    const tagIndexes = (await tags.indexes()).map(({ name }) => name)

    expect(gameIndexes).toEqual(
      expect.arrayContaining([
        'grossRevenue_-1',
        'gameId_1',
        'tagIds_1',
        'releaseYear_1',
        'basePrice_1'
      ])
    )
    expect(tagIndexes).toEqual(expect.arrayContaining(['tagId_1', 'slug_1']))
  })

  it('converts an existing non-unique gameId index to unique.', async () => {
    await resetDatabaseConnection()
    process.env.DB_DATABASE = `test-${randomUUID()}`

    const { MongoClient } = await import('mongodb')
    const raw = new MongoClient(inject('mongoUri'))

    await raw.connect()
    await raw.db(process.env.DB_DATABASE).collection('games').createIndex({ gameId: 1 })
    await raw.close()

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const games = await getCollection('games')

    const gameIdIndex = (await games.indexes()).find(({ name }) => name === 'gameId_1')

    expect(gameIdIndex?.unique).toEqual(true)
    expect(consoleError).not.toHaveBeenCalled()

    consoleError.mockRestore()
  })

  it('still serves when duplicate game ids block the unique index.', async () => {
    await resetDatabaseConnection()
    process.env.DB_DATABASE = `test-${randomUUID()}`

    const { MongoClient } = await import('mongodb')
    const raw = new MongoClient(inject('mongoUri'))

    await raw.connect()
    const rawGames = raw.db(process.env.DB_DATABASE).collection('games')
    await rawGames.createIndex({ gameId: 1 })
    await rawGames.insertMany([{ gameId: 1 }, { gameId: 1 }])
    await raw.close()

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const games = await getCollection('games')

    expect(await games.countDocuments()).toEqual(2)
    expect(consoleError).toHaveBeenCalledWith('Failed to create index:', expect.any(String))

    consoleError.mockRestore()
  })
})
