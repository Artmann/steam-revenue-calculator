//@ts-ignore
import { MongoClient } from 'mongodb'

let client: any
let indexesEnsured = false

async function ensureIndexes(mongoClient: any): Promise<void> {
  if (indexesEnsured) { return }
  indexesEnsured = true
  const databaseName = process.env.DB_DATABASE ?? ''
  const db = mongoClient.db(databaseName)
  const games = db.collection('games')
  const tags = db.collection('tags')

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
    games.createIndex({ grossRevenue: -1 }, { background: true }),
    games.createIndex({ gameId: 1 }, { background: true, unique: true }),
    games.createIndex({ tagIds: 1 }, { background: true }),
    games.createIndex({ releaseYear: 1 }, { background: true }),
    games.createIndex({ basePrice: 1 }, { background: true }),
    tags.createIndex({ tagId: 1 }, { background: true, unique: true }),
    tags.createIndex({ slug: 1 }, { background: true, unique: true })
  ])

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Failed to create index:', result.reason?.message)
    }
  }
}

export async function getCollection(collectionName: string) {
  const url = process.env.DB_URL ?? 'mongodb://127.0.0.1:27017/'
  const poolSize = parseInt(process.env.DB_POOL_SIZE ?? '10', 10)
  const databaseName = process.env.DB_DATABASE ?? ''

  client =
    client ??
    (await MongoClient.connect(url, {
      poolSize,
      useNewUrlParser: true,
      useUnifiedTopology: true
    }))

  await ensureIndexes(client)

  const database = await client.db(databaseName)
  const collection = await database.collection(collectionName)

  return collection
}
