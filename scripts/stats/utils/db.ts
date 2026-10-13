import { MongoClient, type Collection } from 'mongodb'

// Shared as a promise so concurrent first calls don't open separate clients.
let client: Promise<MongoClient> | undefined

export async function getCollection(
  collectionName: string
): Promise<Collection> {
  const url = process.env.DB_URL ?? 'mongodb://127.0.0.1:27017/'
  const maxPoolSize = parseInt(process.env.DB_POOL_SIZE ?? '10', 10)
  const databaseName = process.env.DB_DATABASE ?? ''

  client = client ?? MongoClient.connect(url, { maxPoolSize })

  return (await client).db(databaseName).collection(collectionName)
}

export async function closeDb(): Promise<void> {
  if (!client) {
    return
  }
  const connected = client
  client = undefined
  await (await connected).close()
}
