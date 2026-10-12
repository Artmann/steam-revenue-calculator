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

  it('still serves when an existing non-unique gameId index conflicts.', async () => {
    await resetDatabaseConnection()
    process.env.DB_DATABASE = `test-${randomUUID()}`

    const { MongoClient } = await import('mongodb')
    const raw = new MongoClient(inject('mongoUri'))

    await raw.connect()
    await raw.db(process.env.DB_DATABASE).collection('games').createIndex({ gameId: 1 })
    await raw.close()

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const games = await getCollection('games')

    await games.insertOne({ gameId: 1 })

    expect(await games.countDocuments()).toBe(1)
    expect(consoleError).toHaveBeenCalledWith('Failed to create index:', expect.any(String))

    consoleError.mockRestore()
  })
})
