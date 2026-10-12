import { getCollection } from '~/db'
import { computeAllTagStats } from '~/market/compute-all'
import { loadMarketGames } from '~/market/market-service.server'
import type { StatsSummary } from '~/scrape/run-record'

export async function computeAndSaveStats(): Promise<StatsSummary> {
  // Only games scraped since tags were introduced carry tagIds.
  const games = await loadMarketGames({ 'tagIds.0': { $exists: true } })
  const { baseline, tags } = computeAllTagStats(games)
  const now = new Date()

  const marketStats = await getCollection('marketStats')

  await marketStats.updateOne(
    { _id: 'all' as any },
    { $set: { ...baseline, updatedAt: now } },
    { upsert: true }
  )

  const results = new Map(tags.map((result) => [result.tagId, result]))
  const tagsCollection = await getCollection('tags')
  const tagIds = (
    (await tagsCollection
      .find({})
      .project({ _id: 0, tagId: 1 })
      .toArray()) as { tagId: number }[]
  ).map(({ tagId }) => tagId)

  const operations = tagIds.map((tagId) => {
    const result = results.get(tagId)

    return result?.stats
      ? {
          updateOne: {
            filter: { tagId },
            update: {
              $set: {
                gameCount: result.gameCount,
                stats: result.stats,
                statsUpdatedAt: now
              }
            }
          }
        }
      : {
          updateOne: {
            filter: { tagId },
            update: {
              $set: { gameCount: result?.gameCount ?? 0 },
              $unset: { stats: '', statsUpdatedAt: '' }
            }
          }
        }
  })

  if (operations.length > 0) {
    await tagsCollection.bulkWrite(operations, { ordered: false })
  }

  return {
    games: games.length,
    tags: tagIds.length,
    tagsWithStats: tags.filter(({ stats }) => stats).length
  }
}
