import type { LoaderFunction } from 'react-router'
//@ts-ignore
import mongodb from 'mongodb'

import fs from 'fs'

import { getCollection } from '~/db'
import { createTagSlugs } from '~/market/tag-slugs'
import { buildGameUpsert } from '~/steam/build-game-upsert'
import { mapStoreItem, type ScrapedGame } from '~/steam/map-store-item'
import {
  fetchAppIdPage,
  fetchStoreItems,
  fetchTagList,
  type RequestOptions
} from '~/steam/store-api'

const pageSize = 1000
// Stay under the 60s Vercel limit so the write and cursor always happen.
const timeBudgetMs = 45_000

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  const deadline = Date.now() + timeBudgetMs
  const cursor = parseInt(url.searchParams.get('cursor') ?? '0', 10) || 0
  const expectedKey = process.env.SCRAPE_KEY
  const apiKey = process.env.STEAM_API_KEY

  if (!expectedKey || !key || key !== expectedKey) {
    return new Response('Unauthorized.', { status: 401 })
  }

  if (!apiKey) {
    return new Response('STEAM_API_KEY is not configured.', { status: 500 })
  }

  if (cursor === 0) {
    await syncTags({ deadline })
  }

  const ignoredIds = new Set(await loadIgnoredIds())
  const page = await fetchAppIdPage(apiKey, cursor, pageSize, {
    deadline
  })
  const appIds = page.appIds.filter((appId) => !ignoredIds.has(appId))

  const { items, failedIds } = await fetchStoreItems(appIds, {
    deadline
  })

  const games = items
    .map(mapStoreItem)
    .filter((game): game is ScrapedGame => Boolean(game))

  if (games.length > 0) {
    const collection = await getCollection('games')
    const now = Date.now()

    await collection.bulkWrite(
      games.map((game) =>
        buildGameUpsert(game, now, new mongodb.ObjectId().toHexString())
      ),
      { ordered: false }
    )
  }

  return new Response(
    JSON.stringify({
      cursor,
      nextCursor: page.haveMoreResults ? page.lastAppId : 0,
      fetched: appIds.length,
      saved: games.length,
      failed: failedIds.length
    }),
    {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    }
  )
}

async function syncTags(options: RequestOptions): Promise<void> {
  const tags = createTagSlugs(await fetchTagList(options))

  if (tags.length === 0) {
    return
  }

  const collection = await getCollection('tags')

  await collection.bulkWrite(
    tags.map(({ tagId, name, slug }) => ({
      updateOne: {
        filter: { tagId },
        update: {
          $set: { name, slug },
          $setOnInsert: { gameCount: 0 }
        },
        upsert: true
      }
    })),
    { ordered: false }
  )
}

async function loadIgnoredIds(): Promise<number[]> {
  try {
    const data = await fs.promises.readFile('./data/ignored.json', 'utf-8')

    return JSON.parse(data) ?? []
  } catch (error) {
    console.error(error)
  }

  return []
}
