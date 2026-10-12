import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest'

import { getCollection, resetDatabaseConnection } from '~/db'
import { loader } from '~/routes/api.scrape-games'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

const storeItem = {
  id: 10,
  appid: 10,
  success: 1,
  name: 'Counter-Strike',
  tags: [{ tagid: 19, weight: 100 }],
  reviews: { summary_filtered: { review_count: 1000, percent_positive: 90 } },
  release: { steam_release_date: 946684800 },
  basic_info: {
    short_description: 'Classic.',
    developers: [{ name: 'Valve' }],
    publishers: [{ name: 'Valve' }]
  },
  best_purchase_option: { final_price_in_cents: '999' }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  })
}

function stubSteam(name: string) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)

    if (url.includes('GetTagList')) {
      return jsonResponse({ response: { tags: [{ tagid: 19, name: 'Action' }] } })
    }

    if (url.includes('GetAppList')) {
      return jsonResponse({
        response: { apps: [{ appid: 10 }], have_more_results: false, last_appid: 10 }
      })
    }

    if (url.includes('GetItems')) {
      return jsonResponse({ response: { store_items: [{ ...storeItem, name }] } })
    }

    throw new Error(`Unexpected fetch: ${url.split('?')[0]}`)
  })
}

function request(cursor = 0): Request {
  return new Request(
    `http://localhost/api/scrape-games?key=test-key&cursor=${cursor}`
  )
}

beforeEach(() => {
  process.env.SCRAPE_KEY = 'test-key'
  process.env.STEAM_API_KEY = 'test-steam-key'
})

describe('scrape-games loader (real MongoDB)', () => {
  it('upserts games and tags, then updates the same document on rescrape.', async () => {
    stubSteam('Counter-Strike')

    const first = (await loader({ request: request(), params: {}, context: {} } as any)) as Response

    expect(await first.json()).toEqual({
      cursor: 0,
      nextCursor: 0,
      fetched: 1,
      saved: 1,
      failed: 0
    })

    vi.restoreAllMocks()
    stubSteam('Counter-Strike Renamed')

    await loader({ request: request(), params: {}, context: {} } as any)

    const games = await getCollection('games')
    const documents = await games.find({ gameId: 10 }).toArray()
    const tags = await (await getCollection('tags')).find({}).toArray()

    expect(documents).toHaveLength(1)
    expect(documents[0].details.name).toBe('Counter-Strike Renamed')
    expect(documents[0].tagIds).toEqual([19])
    expect(tags.map(({ slug }) => slug)).toEqual(['action'])

    vi.restoreAllMocks()
  })

  it('skips app ids from the ignore list.', async () => {
    const ignoredAppId = 216938
    const requestedIds: number[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)

      if (url.includes('GetAppList')) {
        return jsonResponse({
          response: {
            apps: [{ appid: 10 }, { appid: ignoredAppId }],
            have_more_results: false,
            last_appid: ignoredAppId
          }
        })
      }

      if (url.includes('GetItems')) {
        const inputJson = JSON.parse(
          decodeURIComponent(url.split('input_json=')[1])
        ) as { ids: { appid: number }[] }

        requestedIds.push(...inputJson.ids.map(({ appid }) => appid))

        return jsonResponse({ response: { store_items: [storeItem] } })
      }

      throw new Error(`Unexpected fetch: ${url.split('?')[0]}`)
    })

    const response = (await loader({
      request: request(ignoredAppId),
      params: {},
      context: {}
    } as any)) as Response

    expect(response.status).toBe(200)
    expect(requestedIds).toEqual([10])

    vi.restoreAllMocks()
  })

  it('rejects requests without the key.', async () => {
    const response = (await loader({
      request: new Request('http://localhost/api/scrape-games'),
      params: {},
      context: {}
    } as any)) as Response

    expect(response.status).toBe(401)
  })
})
