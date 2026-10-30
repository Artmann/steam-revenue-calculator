import { beforeEach, describe, it, expect, vi } from 'vitest'

const { command, createIndex, dropIndex, constructed } = vi.hoisted(() => ({
  command: vi.fn(),
  constructed: vi.fn(),
  createIndex: vi.fn(),
  dropIndex: vi.fn()
}))

vi.mock('mongodb', () => ({
  MongoClient: class {
    constructor() {
      constructed()
    }

    async connect() {
      return this
    }

    db() {
      return {
        collection: (name: string) => ({ name, createIndex, dropIndex }),
        command
      }
    }

    async close() {}
  }
}))

import {
  ensureDatabaseIndexes,
  getCollection,
  resetDatabaseConnection
} from '~/db'

beforeEach(async () => {
  await resetDatabaseConnection()
  vi.clearAllMocks()
})

describe('ensureDatabaseIndexes', () => {
  it('converts a conflicting non-unique gameId index to unique in place.', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    dropIndex.mockRejectedValue({ code: 27, codeName: 'IndexNotFound' })
    command.mockResolvedValue({ ok: 1 })
    createIndex.mockImplementation(async (keys: Record<string, number>) => {
      if (Object.keys(keys).join() === 'gameId') {
        throw Object.assign(new Error('An existing index has the same name'), {
          code: 86,
          codeName: 'IndexKeySpecsConflict'
        })
      }
    })

    await ensureDatabaseIndexes()

    expect(command.mock.calls).toEqual([
      [
        {
          collMod: 'games',
          index: { keyPattern: { gameId: 1 }, prepareUnique: true }
        }
      ],
      [{ collMod: 'games', index: { keyPattern: { gameId: 1 }, unique: true } }]
    ])
    expect(consoleError).not.toHaveBeenCalled()

    consoleError.mockRestore()
  })

  it('finishes even when an index cannot be created.', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    dropIndex.mockRejectedValue({ code: 27, codeName: 'IndexNotFound' })
    command.mockRejectedValue(new Error('Cannot convert the index to unique'))
    createIndex.mockImplementation(async (keys: Record<string, number>) => {
      if (Object.keys(keys).join() === 'gameId') {
        throw Object.assign(new Error('An existing index has the same name'), {
          code: 86,
          codeName: 'IndexKeySpecsConflict'
        })
      }
    })

    await ensureDatabaseIndexes()

    expect(createIndex).toHaveBeenCalledTimes(11)
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to create index:',
      'Cannot convert the index to unique'
    )

    consoleError.mockRestore()
  })

  it('fails when the database rejects the attempt.', async () => {
    dropIndex.mockRejectedValue(new Error('network blip'))

    await expect(ensureDatabaseIndexes()).rejects.toThrow('network blip')
  })
})

describe('getCollection', () => {
  it('shares one client between concurrent first calls.', async () => {
    await Promise.all([
      getCollection('games'),
      getCollection('tags'),
      getCollection('games')
    ])

    expect(constructed).toHaveBeenCalledTimes(1)
  })

  it('leaves index creation to the scraper.', async () => {
    await getCollection('games')

    expect(dropIndex).not.toHaveBeenCalled()
    expect(createIndex).not.toHaveBeenCalled()
  })
})
