const createIndex = jest.fn()
const dropIndex = jest.fn()

jest.mock('mongodb', () => ({
  MongoClient: {
    connect: jest.fn(async () => ({
      db: () => ({
        collection: (name: string) => ({ name, createIndex, dropIndex })
      })
    }))
  }
}))

import { getCollection } from '~/db'

describe('getCollection', () => {
  it('returns the collection even when an index conflicts with an existing one.', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

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

    expect(collection.name).toBe('games')
    expect(createIndex).toHaveBeenCalledTimes(7)
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to create index:',
      'An existing index has the same name'
    )

    consoleError.mockRestore()
  })
})
