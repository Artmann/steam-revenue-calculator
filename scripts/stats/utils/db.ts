import { MongoClient, type Collection } from 'mongodb'

let client: MongoClient | undefined

export async function getCollection(
  collectionName: string
): Promise<Collection> {
  const url = process.env.DB_URL ?? 'mongodb://127.0.0.1:27017/'
  const maxPoolSize = parseInt(process.env.DB_POOL_SIZE ?? '10', 10)
  const databaseName = process.env.DB_DATABASE ?? ''

  client = client ?? (await MongoClient.connect(url, { maxPoolSize }))

  return client.db(databaseName).collection(collectionName)
}

export async function closeDb(): Promise<void> {
  if (!client) {
    return
  }
  await client.close()
  client = undefined
}
