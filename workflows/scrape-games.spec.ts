import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { start } from 'workflow/api'

import { getCollection, resetDatabaseConnection } from '~/db'
import { findRun } from '~/scrape/run-record'
import { decodeGetItemsAppIds } from '~/steam/get-items-request'
import type { StoreItem } from '~/steam/types'

import { scrapeGames } from './scrape-games'

interface FakeSteam {
  appIds: number[]
  withReviews?: boolean
  freeIds?: number[]
  // Return a status to fail a GetItems call for these ids.
  getItemsStatus?: (appIds: number[]) => number | undefined
  tagListGate?: Promise<void>
}

const realFetch = globalThis.fetch

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  })
}

function storeItem(appId: number, fake: FakeSteam): StoreItem {
  return {
    id: appId,
    appid: appId,
    success: 1,
    name: `Game ${appId}`,
    is_free: fake.freeIds?.includes(appId) ?? false,
    tags: [{ tagid: 19, weight: 100 }],
    ...(fake.withReviews === false
      ? {}
      : { reviews: { summary_filtered: { review_count: 100, percent_positive: 90 } } }),
    release: { steam_release_date: 1_600_000_000 },
    basic_info: {
      short_description: 'A game.',
      developers: [{ name: 'Dev' }],
      publishers: [{ name: 'Pub' }]
    },
    best_purchase_option: { final_price_in_cents: '999' }
  }
}

function installFakeSteam(fake: FakeSteam) {
  const calls = { tagList: 0, getItems: 0 }

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)

    if (!url.startsWith('https://api.steampowered.com/')) {
      return realFetch(input, init)
    }

    if (url.includes('GetTagList')) {
      calls.tagList += 1
      await fake.tagListGate

      return jsonResponse({ response: { tags: [{ tagid: 19, name: 'Action' }] } })
    }

    if (url.includes('GetAppList')) {
      const params = new URL(url).searchParams
      const after = Number(params.get('last_appid'))
      const max = Number(params.get('max_results'))
      const remaining = fake.appIds.filter((appId) => appId > after)
      const page = remaining.slice(0, max)

      return jsonResponse({
        response: {
          apps: page.map((appid) => ({ appid })),
          have_more_results: remaining.length > page.length,
          last_appid: page[page.length - 1]
        }
      })
    }

    if (url.includes('GetItems')) {
      calls.getItems += 1

      const ids = decodeGetItemsAppIds(
        new URL(url).searchParams.get('input_protobuf_encoded') ?? ''
      )
      const status = fake.getItemsStatus?.(ids)

      if (status) {
        return new Response('', { status })
      }

      return jsonResponse({
        response: { store_items: ids.map((appId) => storeItem(appId, fake)) }
      })
    }

    throw new Error(`Unexpected Steam call: ${url.split('?')[0]}`)
  })

  return calls
}

// Fake catalog ids sit above every id in data/ignored.json, which listAppIds drops.
const base = 10_000_000

function id(n: number): number {
  return base + n
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => id(from + index))
}

async function runToCompletion() {
  const run = await start(scrapeGames, [{ trigger: 'manual' }])
  const result = await run.returnValue

  return { run, result, record: await findRun(run.runId) }
}

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
  process.env.STEAM_API_KEY = 'test-steam-key'
  process.env.STEAM_RATE_LIMIT_RETRY_AFTER_MS = '10'
  process.env.STEAM_RATE_LIMIT_BACKOFF_MS = '1'
})

afterAll(async () => {
  await resetDatabaseConnection()
})

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})

  for (const name of ['games', 'tags', 'scrapeRuns', 'marketStats']) {
    await (await getCollection(name)).deleteMany({})
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('scrapeGames workflow', () => {
  it('scrapes every chunk, computes stats and records a succeeded run.', async () => {
    installFakeSteam({ appIds: range(1, 9000) })

    const { run, result, record } = await runToCompletion()

    expect(result).toEqual({ skipped: false, runId: run.runId })
    expect(record).toMatchObject({
      trigger: 'manual',
      status: 'succeeded',
      listed: 9000,
      delisted: { count: 0 },
      stats: { games: 9000, tags: 1 }
    })
    expect(Object.keys(record?.chunks ?? {})).toEqual(['0', '1', '2'])
    expect(record?.retry).toBeUndefined()

    const games = await getCollection('games')

    expect(await games.countDocuments({})).toBe(9000)
    expect(await games.countDocuments({ listedAt: record?.startedAt.getTime() })).toBe(9000)
    expect(await (await getCollection('tags')).findOne({ tagId: 19 })).toMatchObject({
      slug: 'action'
    })
  })

  it('recovers a failed batch in the retry pass.', async () => {
    let failed = false

    installFakeSteam({
      appIds: range(1, 800),
      getItemsStatus: (ids) => {
        if (!failed && ids.includes(id(1))) {
          failed = true

          return 500
        }
      }
    })

    const { record } = await runToCompletion()

    expect(record?.chunks?.['0'].failedIds).toEqual(range(1, 700))
    expect(record?.retry).toEqual({ attempted: 700, saved: 700, stillFailed: [] })
    expect(await (await getCollection('games')).countDocuments({})).toBe(800)
  })

  it('keeps going when a chunk exhausts its retries and records the ids.', async () => {
    installFakeSteam({
      appIds: range(1, 4300),
      getItemsStatus: (ids) => (ids.includes(id(1)) ? 429 : undefined)
    })

    const { record } = await runToCompletion()

    expect(record?.status).toBe('succeeded')
    expect(record?.chunks?.['0']).toEqual({ saved: 0, failedIds: range(1, 4200) })
    expect(record?.chunks?.['1'].saved).toBe(100)
    expect(record?.retry).toEqual({
      attempted: 4200,
      saved: 0,
      stillFailed: range(1, 4200)
    })
  })

  it('flags unlisted games, unflags returning ones and leaves listed free games alone.', async () => {
    const games = await getCollection('games')

    await games.insertMany([
      { gameId: id(9999), slug: 'gone', details: { name: 'Gone Game' } },
      { gameId: id(5), slug: 'back', details: { name: 'Back' }, delistedAt: 1 },
      { gameId: id(7), slug: 'free', details: { name: 'Free Now' } }
    ])

    installFakeSteam({ appIds: range(1, 100), freeIds: [id(7)] })

    const { record } = await runToCompletion()
    const startedAt = record?.startedAt.getTime()

    expect(record?.delisted).toEqual({ count: 1 })
    expect(await games.findOne({ gameId: id(9999) })).toMatchObject({
      delistedAt: startedAt,
      details: { name: 'Gone Game' }
    })
    expect(await games.findOne({ gameId: id(5) })).not.toHaveProperty('delistedAt')
    expect(await games.findOne({ gameId: id(7) })).not.toHaveProperty('delistedAt')
  })

  it('skips delisting when Steam returns a truncated list.', async () => {
    await (await getCollection('games')).insertMany(
      range(1, 100).map((gameId) => ({ gameId, slug: `game-${gameId}` }))
    )

    installFakeSteam({ appIds: range(1, 50) })

    const { record } = await runToCompletion()

    expect(record?.delisted).toEqual({ skipped: true, listed: 50, active: 100 })
    expect(
      await (await getCollection('games')).countDocuments({ delistedAt: { $exists: true } })
    ).toBe(0)
  })

  it('skips a second run while the first is still active.', async () => {
    let release = () => {}
    const tagListGate = new Promise<void>((resolve) => {
      release = resolve
    })
    const calls = installFakeSteam({ appIds: range(1, 10), tagListGate })

    const first = await start(scrapeGames, [{ trigger: 'cron' }])

    await vi.waitFor(() => expect(calls.tagList).toBe(1), { timeout: 30_000 })

    const second = await start(scrapeGames, [{ trigger: 'manual' }])

    expect(await second.returnValue).toEqual({
      skipped: true,
      activeRunId: first.runId
    })

    release()

    expect(await first.returnValue).toEqual({ skipped: false, runId: first.runId })
    expect(await findRun(second.runId)).toBeNull()
  })

  it('runs again after a finished run and unsets fields Steam stopped reporting.', async () => {
    installFakeSteam({ appIds: [id(1)] })
    await runToCompletion()

    const games = await getCollection('games')

    expect((await games.findOne({ gameId: id(1) }))?.percentPositive).toBe(90)

    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    installFakeSteam({ appIds: [id(1)], withReviews: false })

    const { result } = await runToCompletion()

    expect(result).toMatchObject({ skipped: false })
    expect(await games.findOne({ gameId: id(1) })).not.toHaveProperty('percentPositive')
  })

  it('marks the run failed when the Steam key is missing.', async () => {
    const apiKey = process.env.STEAM_API_KEY

    delete process.env.STEAM_API_KEY
    installFakeSteam({ appIds: [id(1)] })

    try {
      const run = await start(scrapeGames, [{ trigger: 'cron' }])

      await expect(run.returnValue).rejects.toThrow()
      expect(await findRun(run.runId)).toMatchObject({
        status: 'failed',
        error: expect.stringContaining('STEAM_API_KEY')
      })
    } finally {
      process.env.STEAM_API_KEY = apiKey
    }
  })
})
