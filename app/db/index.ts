//@ts-ignore
import { MongoClient } from 'mongodb'

let client: any
let indexesEnsured = false

async function ensureIndexes(mongoClient: any): Promise<void> {
  if (indexesEnsured) { return }
  indexesEnsured = true
  const databaseName = process.env.DB_DATABASE ?? ''
  const db = mongoClient.db(databaseName)
  await db.collection('games').createIndex({ grossRevenue: -1 }, { background: true })
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
