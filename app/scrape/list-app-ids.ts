import { getCollection } from '~/db'
import { chunk } from '~/scrape/chunk'
import { ignoredAppIds } from '~/steam/ignored-app-ids'
import { fetchAppIdPage } from '~/steam/store-api'

// GetAppList's largest page.
const appListPageSize = 50_000
const updateSliceSize = 10_000

export async function listAppIds(
  apiKey: string,
  runStartedAt: number
): Promise<number[]> {
  const seen = new Set<number>()
  let cursor = 0

  for (;;) {
    const page = await fetchAppIdPage(apiKey, cursor, appListPageSize)

    for (const appId of page.appIds) {
      seen.add(appId)
    }

    // Stop on the last page, and on a page that cannot advance the cursor.
    if (!page.haveMoreResults || page.lastAppId <= cursor) {
      break
    }

    cursor = page.lastAppId
  }

  const appIds = [...seen]
    .filter((appId) => !ignoredAppIds.has(appId))
    .sort((a, b) => a - b)

  const games = await getCollection('games')

  for (const slice of chunk(appIds, updateSliceSize)) {
    // Sequential on purpose: keeps one large write in flight at a time.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await games.updateMany(
      { gameId: { $in: slice } },
      { $set: { listedAt: runStartedAt }, $unset: { delistedAt: '' } }
    )
  }

  return appIds
}
