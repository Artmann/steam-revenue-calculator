import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { listAppIds } from '~/scrape/list-app-ids'
import { scrapeIds } from '~/scrape/scrape-ids'
import { syncTags } from '~/scrape/sync-tags'
import { decodeGetItemsAppIds } from '~/steam/get-items-request'
import type { StoreItem } from '~/steam/types'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

beforeEach(async () => {
  for (const name of ['games', 'tags']) {
    await (await getCollection(name)).deleteMany({})
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  })
}

function storeItem(appId: number, withReviews = true): StoreItem {
  return {
    id: appId,
    appid: appId,
    success: 1,
    name: `Game ${appId}`,
    tags: [{ tagid: 19, weight: 100 }],
    ...(withReviews
      ? { reviews: { summary_filtered: { review_count: 100, percent_positive: 90 } } }
      : {}),
    release: { steam_release_date: 1_600_000_000 },
    basic_info: {
      short_description: 'A game.',
      developers: [{ name: 'Dev' }],
      publishers: [{ name: 'Pub' }]
    },
    best_purchase_option: { final_price_in_cents: '999' }
  }
}

function requestedIds(url: string): number[] {
  return decodeGetItemsAppIds(new URL(url).searchParams.get('input_protobuf_encoded') ?? '')
}

describe('syncTags (real MongoDB)', () => {
  it('keeps published slugs and inserts new tags with a zero game count.', async () => {
    const tags = await getCollection('tags')

    await tags.insertOne({ tagId: 500, name: 'Indie', slug: 'indie', gameCount: 7 })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        response: {
          tags: [
            { tagid: 3, name: 'Indie' },
            { tagid: 500, name: 'Indie' }
          ]
        }
      })
    )

    expect(await syncTags()).toBe(2)

    const documents = await tags
      .find({})
      .project({ _id: 0 })
      .sort({ tagId: 1 })
      .toArray()

    expect(documents).toEqual([
      { tagId: 3, name: 'Indie', slug: 'indie-3', gameCount: 0 },
      { tagId: 500, name: 'Indie', slug: 'indie', gameCount: 7 }
    ])
  })
})

describe('listAppIds (real MongoDB)', () => {
  it('pages until Steam has no more results, dropping ignored ids.', async () => {
    const cursors: string[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const cursor = new URL(String(input)).searchParams.get('last_appid') ?? ''

      cursors.push(cursor)

      return cursor === '0'
        ? jsonResponse({
            response: {
              apps: [{ appid: 10 }, { appid: 216938 }],
              have_more_results: true,
              last_appid: 216938
            }
          })
        : jsonResponse({
            response: { apps: [{ appid: 300000 }], have_more_results: false }
          })
    })

    expect(await listAppIds('test-key', 1)).toEqual([10, 300000])
    expect(cursors).toEqual(['0', '216938'])
  })

  it('stops on an empty page that claims more results.', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        jsonResponse({ response: { have_more_results: true } })
      )

    expect(await listAppIds('test-key', 1)).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stops when the cursor would not move forward.', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        jsonResponse({
          response: { apps: [{ appid: 6 }], have_more_results: true, last_appid: 0 }
        })
      )

    expect(await listAppIds('test-key', 1)).toEqual([6])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('marks listed games and clears their delisted flag.', async () => {
    const games = await getCollection('games')

    await games.insertMany([
      { gameId: 10, slug: 'a', delistedAt: 1 },
      { gameId: 11, slug: 'b' }
    ])

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ response: { apps: [{ appid: 10 }], have_more_results: false } })
    )

    await listAppIds('test-key', 1234)

    const listed = await games.findOne({ gameId: 10 })
    const unlisted = await games.findOne({ gameId: 11 })

    expect(listed?.listedAt).toBe(1234)
    expect(listed).not.toHaveProperty('delistedAt')
    expect(unlisted).not.toHaveProperty('listedAt')
  })
})

describe('scrapeIds (real MongoDB)', () => {
  it('upserts games, reports failed batches, and unsets fields on rescrape.', async () => {
    let withReviews = true

    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const ids = requestedIds(String(input))

      if (ids.includes(999)) {
        return new Response('', { status: 500 })
      }

      return jsonResponse({
        response: { store_items: ids.map((id) => storeItem(id, withReviews)) }
      })
    })

    const ids = [...Array.from({ length: 700 }, (_, index) => index + 1), 999]

    expect(await scrapeIds(ids, 77)).toEqual({ saved: 700, failedIds: [999] })

    const games = await getCollection('games')
    const first = await games.findOne({ gameId: 1 })

    expect(first).toMatchObject({ listedAt: 77, percentPositive: 90 })

    await games.updateOne({ gameId: 1 }, { $set: { contentUpdatedAt: 5 } })
    await scrapeIds([1], 78)

    // Same content: the change time stays put.
    expect((await games.findOne({ gameId: 1 }))?.contentUpdatedAt).toBe(5)

    withReviews = false

    await scrapeIds([1], 78)

    const rescraped = await games.findOne({ gameId: 1 })

    expect(await games.countDocuments({ gameId: 1 })).toBe(1)
    expect(rescraped?.listedAt).toBe(78)
    expect(rescraped).not.toHaveProperty('percentPositive')
    expect(rescraped?.contentUpdatedAt).toBeGreaterThan(5)
  })
})
