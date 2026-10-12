import { getCollection } from '~/db'
import { computeAllTagStats } from '~/market/compute-all'
import { loadMarketGames } from '~/market/market-service.server'
import { createTagSlugs } from '~/market/tag-slugs'
import { calculateRevenue } from '~/revenue'
import { buildGameUpsert } from '~/steam/build-game-upsert'
import type { ScrapedGame } from '~/steam/map-store-item'

const url = process.env.DB_URL ?? ''
const databaseName = process.env.DB_DATABASE ?? ''

if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  console.error('Refusing to seed: DB_URL must point at a local MongoDB.')
  process.exit(1)
}

if (!databaseName) {
  console.error('Refusing to seed: DB_DATABASE must be set.')
  process.exit(1)
}

const now = Date.UTC(2026, 0, 1)

const tags = createTagSlugs([
  { tagid: 19, name: 'Action' },
  { tagid: 492, name: 'Indie' },
  { tagid: 1664, name: 'Puzzle' },
  { tagid: 597, name: 'Casual' }
])

// The first six are on the home page's popular list.
const names: [number, string][] = [
  [367520, 'Hollow Knight'],
  [1817230, 'Hi-Fi RUSH'],
  [1145360, 'Hades'],
  [973230, 'Raft'],
  [391540, 'Undertale'],
  [207610, 'The Walking Dead']
]

for (let index = 0; names.length < 40; index++) {
  names.push([900000 + index, `Seed Game ${index + 1}`])
}

const games: ScrapedGame[] = names.map(([gameId, name], index) => {
  const reviewCount = 50 + index * 137
  const basePrice = 499 + (index % 5) * 500
  const tagIds =
    index % 3 === 0 ? [19, 492] : index % 3 === 1 ? [492, 1664] : [19, 597]
  const releaseDate = new Date(Date.UTC(2018 + (index % 7), index % 12, 1))

  return {
    gameId,
    name,
    description: `${name} is a seeded game used for local parity checks.`,
    developers: [`Studio ${(index % 4) + 1}`],
    publishers: [`Publisher ${(index % 3) + 1}`],
    screenshots: [],
    tagIds,
    releaseDate,
    releaseYear: releaseDate.getUTCFullYear(),
    reviewCount,
    percentPositive: 70 + (index % 30),
    price: basePrice,
    basePrice,
    grossRevenue: calculateRevenue(reviewCount, basePrice / 100)
  }
})

async function main(): Promise<void> {
  const gamesCollection = await getCollection('games')
  const tagsCollection = await getCollection('tags')
  const marketStats = await getCollection('marketStats')

  await gamesCollection.deleteMany({})
  await tagsCollection.deleteMany({})
  await marketStats.deleteMany({})

  await gamesCollection.bulkWrite(
    games.map((game) =>
      buildGameUpsert(game, now, `seed-${game.gameId}`)
    ),
    { ordered: false }
  )

  await tagsCollection.insertMany(
    tags.map(({ tagId, name, slug }) => ({ tagId, name, slug, gameCount: 0 }))
  )

  const marketGames = await loadMarketGames({ 'tagIds.0': { $exists: true } })
  const { baseline, tags: results } = computeAllTagStats(marketGames)
  const updatedAt = new Date(now)

  await marketStats.updateOne(
    { _id: 'all' as any },
    { $set: { ...baseline, updatedAt } },
    { upsert: true }
  )

  for (const result of results) {
    await tagsCollection.updateOne(
      { tagId: result.tagId },
      {
        $set: result.stats
          ? {
              gameCount: result.gameCount,
              stats: result.stats,
              statsUpdatedAt: updatedAt
            }
          : { gameCount: result.gameCount }
      }
    )
  }

  console.log(`Seeded ${games.length} games and ${tags.length} tags.`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
