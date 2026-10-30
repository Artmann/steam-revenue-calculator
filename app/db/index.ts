import { MongoClient, type Collection, type Db } from 'mongodb'

import { gamesSitemapIndex } from '~/sitemap/xml'

let client: MongoClient | undefined

const indexKeySpecsConflict = 86
const databaseWaitLimit = 3_000

// Production has a non-unique gameId_1 from before the unique option was
// added. Convert it in place rather than dropping it, so game lookups never
// lose their index. MongoDB refuses the conversion if duplicates exist.
async function ensureUniqueGameIdIndex(db: Db): Promise<void> {
  try {
    await db.collection('games').createIndex({ gameId: 1 }, { unique: true })
  } catch (error: any) {
    if (error?.code !== indexKeySpecsConflict) {
      throw error
    }

    for (const option of ['prepareUnique', 'unique']) {
      await db.command({
        collMod: 'games',
        index: { keyPattern: { gameId: 1 }, [option]: true }
      })
    }
  }
}

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

  // Best effort: an index that conflicts with an existing one must not fail
  // the scrape that runs this.
  const results = await Promise.allSettled([
    games.createIndex({ grossRevenue: -1 }),
    ensureUniqueGameIdIndex(db),
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
  const maxPoolSize = parseInt(process.env.DB_POOL_SIZE ?? '5', 10)
  const databaseName = process.env.DB_DATABASE ?? ''

  // Assign synchronously so concurrent first callers share one client; the
  // driver de-duplicates concurrent connect() calls on the same instance.
  if (!client) {
    // Requests must fail fast when the database struggles: the function is
    // billed for every second it waits. There is no socket timeout because the
    // scraper's bulk operations legitimately run for a long time.
    client = new MongoClient(url, {
      maxPoolSize,
      connectTimeoutMS: databaseWaitLimit,
      serverSelectionTimeoutMS: databaseWaitLimit,
      waitQueueTimeoutMS: databaseWaitLimit
    })
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

  return current.db(databaseName)
}

// Runs from the scraper, never from a request: it takes several round trips,
// and a cold start under load must not spend them.
export async function ensureDatabaseIndexes(): Promise<void> {
  await ensureIndexes(await getDatabase())
}

export async function getCollection(collectionName: string): Promise<Collection> {
  const db = await getDatabase()

  return db.collection(collectionName)
}

export async function resetDatabaseConnection(): Promise<void> {
  const current = client

  client = undefined

  await current?.close()
}
