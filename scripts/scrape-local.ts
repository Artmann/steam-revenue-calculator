// Runs the scrape steps in workflow order against a local MongoDB, without
// the workflow runtime. Calls the real Steam API, so it is opt-in.
//
//   DB_URL=mongodb://127.0.0.1:27017/ DB_DATABASE=src-parity \
//   STEAM_API_KEY=… pnpm scrape:local [limit]
//
// limit caps how many app ids are scraped (default 2000, 0 = all). Delisting
// only runs for a full scrape, since a partial one would flag everything else.
import { ensureDatabaseIndexes, resetDatabaseConnection } from '~/db'
import { computeAndSaveStats } from '~/market/compute-and-save-stats.server'
import { chunk } from '~/scrape/chunk'
import { listAppIds } from '~/scrape/list-app-ids'
import { markDelisted } from '~/scrape/mark-delisted'
import { scrapeIds } from '~/scrape/scrape-ids'
import { syncTags } from '~/scrape/sync-tags'

const url = process.env.DB_URL ?? ''
const databaseName = process.env.DB_DATABASE ?? ''
const apiKey = process.env.STEAM_API_KEY ?? ''
const limit = Number(process.argv[2] ?? '2000')

if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  console.error('Refusing to scrape: DB_URL must point at a local MongoDB.')
  process.exit(1)
}

if (!databaseName) {
  console.error('Refusing to scrape: DB_DATABASE must be set.')
  process.exit(1)
}

if (!apiKey) {
  console.error('STEAM_API_KEY must be set.')
  process.exit(1)
}

if (!Number.isInteger(limit) || limit < 0) {
  console.error('The limit must be a whole number, 0 for everything.')
  process.exit(1)
}

async function main(): Promise<void> {
  const runStartedAt = Date.now()

  await ensureDatabaseIndexes()

  console.log(`Synced ${await syncTags()} tags.`)

  const appIds = await listAppIds(apiKey, runStartedAt)
  const selected = limit > 0 ? appIds.slice(0, limit) : appIds

  console.log(`Steam lists ${appIds.length} games; scraping ${selected.length}.`)

  for (const [index, appIdChunk] of chunk(selected, 1000).entries()) {
    const { saved, failedIds } = await scrapeIds(appIdChunk, runStartedAt)

    console.log(`Chunk ${index}: saved ${saved}, failed ${failedIds.length}.`)
  }

  if (limit === 0) {
    console.log('Delisting:', await markDelisted(runStartedAt, appIds.length))
  }

  console.log('Stats:', await computeAndSaveStats())

  await resetDatabaseConnection()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
