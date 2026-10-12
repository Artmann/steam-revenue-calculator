import { getCollection } from '~/db'
import type { DelistedResult } from '~/scrape/run-record'

// A list shorter than this share of the active games is treated as a bad
// response from Steam, not as mass delisting.
const minimumListedShare = 0.9

export async function markDelisted(
  runStartedAt: number,
  listed: number
): Promise<DelistedResult> {
  const games = await getCollection('games')
  const active = await games.countDocuments({ delistedAt: { $exists: false } })

  if (listed < minimumListedShare * active) {
    console.error(
      `Skipping delisting: Steam listed ${listed} games but ${active} are active.`
    )

    return { skipped: true, listed, active }
  }

  // Delisted games keep all their data; the flag only records when they left Steam.
  const result = await games.updateMany(
    { listedAt: { $ne: runStartedAt }, delistedAt: { $exists: false } },
    { $set: { delistedAt: runStartedAt } }
  )

  return { count: result.modifiedCount }
}
