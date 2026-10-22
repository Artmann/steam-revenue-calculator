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

import { getCollection, resetDatabaseConnection } from '~/db'

beforeEach(async () => {
  await resetDatabaseConnection()
  vi.clearAllMocks()
})

describe('getCollection', () => {
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

    await getCollection('games')

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

  it('returns the collection even when an index cannot be created.', async () => {
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

    const collection = await getCollection('games')

    expect((collection as any).name).toBe('games')
    expect(createIndex).toHaveBeenCalledTimes(11)
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to create index:',
      'Cannot convert the index to unique'
    )

    consoleError.mockRestore()
  })

  it('retries index creation after a failed attempt.', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    dropIndex.mockRejectedValueOnce(new Error('network blip'))
    dropIndex.mockRejectedValue({ code: 27, codeName: 'IndexNotFound' })
    createIndex.mockResolvedValue('ok')

    await expect(getCollection('games')).rejects.toThrow('network blip')
    await getCollection('games')

    expect(createIndex).toHaveBeenCalledTimes(11)

    consoleError.mockRestore()
  })

  it('shares one client and one index attempt between concurrent first calls.', async () => {
    dropIndex.mockRejectedValue({ code: 27, codeName: 'IndexNotFound' })
    createIndex.mockResolvedValue('ok')

    await Promise.all([
      getCollection('games'),
      getCollection('tags'),
      getCollection('games')
    ])

    expect(constructed).toHaveBeenCalledTimes(1)
    expect(dropIndex).toHaveBeenCalledTimes(1)
    expect(createIndex).toHaveBeenCalledTimes(11)
  })
})
