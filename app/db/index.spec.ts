import { beforeEach, describe, it, expect, vi } from 'vitest'

const { createIndex, dropIndex } = vi.hoisted(() => ({
  createIndex: vi.fn(),
  dropIndex: vi.fn()
}))

vi.mock('mongodb', () => ({
  MongoClient: class {
    async connect() {
      return this
    }

    db() {
      return {
        collection: (name: string) => ({ name, createIndex, dropIndex })
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
  it('returns the collection even when an index conflicts with an existing one.', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    dropIndex.mockRejectedValue({ code: 27, codeName: 'IndexNotFound' })
    createIndex.mockImplementation(async (keys: Record<string, number>) => {
      if ('gameId' in keys) {
        throw Object.assign(new Error('An existing index has the same name'), {
          code: 86,
          codeName: 'IndexKeySpecsConflict'
        })
      }
    })

    const collection = await getCollection('games')

    expect((collection as any).name).toBe('games')
    expect(createIndex).toHaveBeenCalledTimes(7)
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to create index:',
      'An existing index has the same name'
    )

    consoleError.mockRestore()
  })

  it('retries index creation after a failed attempt.', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    dropIndex.mockRejectedValueOnce(new Error('network blip'))
    dropIndex.mockRejectedValue({ code: 27, codeName: 'IndexNotFound' })
    createIndex.mockResolvedValue('ok')

    await expect(getCollection('games')).rejects.toThrow('network blip')
    await getCollection('games')

    expect(createIndex).toHaveBeenCalledTimes(7)
  })
})
