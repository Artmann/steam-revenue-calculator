import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { RetryableError } from 'workflow'

import { decodeGetItemsAppIds } from '~/steam/get-items-request'
import { fetchAppIdPage, fetchStoreItems, fetchTagList } from '~/steam/store-api'

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

function errorResponse(status: number) {
  return { ok: false, status, json: async () => ({}) } as Response
}

describe('store api', () => {
  let fetchMock: MockInstance

  beforeEach(() => {
    fetchMock = vi.spyOn(global, 'fetch')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.STEAM_RATE_LIMIT_RETRY_AFTER_MS
    delete process.env.STEAM_RATE_LIMIT_BACKOFF_MS
  })

  it('skips only the failing batch and reports its ids.', async () => {
    const appIds = Array.from({ length: 750 }, (_, index) => index + 1)

    fetchMock
      .mockResolvedValueOnce(
        okResponse({ response: { store_items: [{ appid: 1 }, { appid: 2 }] } })
      )
      .mockResolvedValueOnce(errorResponse(500))

    const result = await fetchStoreItems(appIds)

    expect(result.items).toEqual([{ appid: 1 }, { appid: 2 }])
    expect(result.failedIds).toEqual(appIds.slice(700))
  })

  it('records a batch whose request throws as failed.', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'))

    const result = await fetchStoreItems([1, 2])

    expect(result.failedIds).toEqual([1, 2])
  })

  it('never leaks the api key in error messages.', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(403))

    const error = await fetchAppIdPage('SECRET', 0, 10).catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).not.toContain('SECRET')
    expect(error.message).not.toContain('key=')
  })

  it('gives every request a timeout signal.', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ response: { tags: [] } }))

    await fetchTagList()

    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('turns a rate limit into a retryable error that waits a minute.', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(429))

    const before = Date.now()
    const error = await fetchTagList().catch((e) => e)

    expect(RetryableError.is(error)).toBe(true)
    expect(error.retryAfter.getTime() - before).toBeGreaterThanOrEqual(59_000)
  })

  it('uses the configured rate limit wait when one is set.', async () => {
    process.env.STEAM_RATE_LIMIT_RETRY_AFTER_MS = '10'
    fetchMock.mockResolvedValueOnce(errorResponse(429))

    const before = Date.now()
    const error = await fetchTagList().catch((e) => e)

    expect(error.retryAfter.getTime() - before).toBeLessThan(1_000)
  })

  it('lets a rate limit that outlasts the backoff escape the batch loop.', async () => {
    process.env.STEAM_RATE_LIMIT_BACKOFF_MS = '1'
    fetchMock.mockResolvedValue(errorResponse(429))

    const error = await fetchStoreItems([1, 2]).catch((e) => e)

    expect(RetryableError.is(error)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('retries a rate-limited batch in place and keeps the batches before it.', async () => {
    process.env.STEAM_RATE_LIMIT_BACKOFF_MS = '1'
    const appIds = Array.from({ length: 750 }, (_, index) => index + 1)

    fetchMock
      .mockResolvedValueOnce(okResponse({ response: { store_items: [{ appid: 1 }] } }))
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse({ response: { store_items: [{ appid: 701 }] } }))

    const result = await fetchStoreItems(appIds)

    expect(result).toEqual({ items: [{ appid: 1 }, { appid: 701 }], failedIds: [] })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[2][0])
  })

  it('sends the ids as protobuf and asks for a JSON response.', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ response: { store_items: [] } }))

    await fetchStoreItems([10, 3_489_700])

    const params = new URL(fetchMock.mock.calls[0][0]).searchParams

    expect(params.get('format')).toBe('json')
    expect(decodeGetItemsAppIds(params.get('input_protobuf_encoded') ?? '')).toEqual([
      10, 3_489_700
    ])
  })

  it('uses last_appid as the next cursor when Steam sends it.', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({
        response: { apps: [{ appid: 10 }], have_more_results: true, last_appid: 12 }
      })
    )

    expect(await fetchAppIdPage('k', 0, 10)).toEqual({
      appIds: [10],
      lastAppId: 12,
      haveMoreResults: true
    })
  })

  it('falls back to the last app, then to the requested cursor, never to 0.', async () => {
    fetchMock
      .mockResolvedValueOnce(
        okResponse({ response: { apps: [{ appid: 7 }, { appid: 9 }], have_more_results: true } })
      )
      .mockResolvedValueOnce(okResponse({ response: { have_more_results: true } }))

    expect((await fetchAppIdPage('k', 5, 10)).lastAppId).toBe(9)
    expect((await fetchAppIdPage('k', 500, 10)).lastAppId).toBe(500)
  })
})
