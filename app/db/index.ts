import { MongoClient, type Collection, type Db } from 'mongodb'

import { gamesSitemapIndex } from '~/sitemap/xml'

let client: MongoClient | undefined
let indexes: Promise<void> | undefined

async function ensureIndexes(db: Db): Promise<void> {
  const games = db.collection('games')
  const tags = db.collection('tags')
  const scrapeRuns = db.collection('scrapeRuns')

  // The name lives at details.name, so this index never did anything.
  try {
    await games.dropIndex('name_1')
  } catch (error: any) {
    const message = String(error?.message ?? '')
    const isMissing =
      error?.code === 27 ||
      error?.codeName === 'IndexNotFound' ||
      message.includes('index not found') ||
      error?.code === 26 ||
      error?.codeName === 'NamespaceNotFound' ||
      message.includes('ns not found')

    if (!isMissing) {
      throw error
    }
  }

  // Best effort: an index that conflicts with an existing one (e.g. a
  // non-unique gameId_1 created before the unique option was added) must
  // not fail the request that happened to trigger this.
  const results = await Promise.allSettled([
    games.createIndex({ grossRevenue: -1 }),
    games.createIndex({ gameId: 1 }, { unique: true }),
    games.createIndex({ tagIds: 1 }),
    games.createIndex({ tagIds: 1, grossRevenue: -1, gameId: 1 }),
    games.createIndex({ releaseYear: 1 }),
    games.createIndex({ basePrice: 1 }),
    games.createIndex({ listedAt: 1 }),
    games.createIndex(gamesSitemapIndex),
    tags.createIndex({ tagId: 1 }, { unique: true }),
    tags.createIndex({ slug: 1 }, { unique: true }),
    scrapeRuns.createIndex({ startedAt: -1 })
  ])

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Failed to create index:', result.reason?.message)
    }
  }
}

async function getDatabase(): Promise<Db> {
  const url = process.env.DB_URL ?? 'mongodb://127.0.0.1:27017/'
  const maxPoolSize = parseInt(process.env.DB_POOL_SIZE ?? '10', 10)
  const databaseName = process.env.DB_DATABASE ?? ''

  // Assign synchronously so concurrent first callers share one client; the
  // driver de-duplicates concurrent connect() calls on the same instance.
  if (!client) {
    client = new MongoClient(url, { maxPoolSize })
  }

  const current = client

  try {
    await current.connect()
  } catch (error) {
    if (client === current) {
      client = undefined
    }

    throw error
  }

  const db = current.db(databaseName)

  // Share one attempt between concurrent callers; forget it on failure so
  // the next request retries.
  indexes ??= ensureIndexes(db).catch((error) => {
    indexes = undefined
    throw error
  })

  await indexes

  return db
}

export async function getCollection(collectionName: string): Promise<Collection> {
  const db = await getDatabase()

  return db.collection(collectionName)
}

export async function resetDatabaseConnection(): Promise<void> {
  const current = client

  client = undefined
  indexes = undefined

  await current?.close()
}
