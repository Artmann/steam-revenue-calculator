//@ts-ignore
import { MongoClient } from 'mongodb'

let client: any

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

  const database = await client.db(databaseName)
  const collection = await database.collection(collectionName)

  return collection
}
