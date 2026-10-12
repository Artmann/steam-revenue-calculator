// Imported statically so the list is bundled into the server build. Reading it
// from disk at runtime fails on Vercel, where `data/` is not in the function.
import ignoredAppIdList from '../../data/ignored.json' with { type: 'json' }

if (!Array.isArray(ignoredAppIdList) || ignoredAppIdList.length === 0) {
  throw new Error('data/ignored.json must be a non-empty array of app ids.')
}

export const ignoredAppIds: ReadonlySet<number> = new Set(ignoredAppIdList)
