import { fetchAppIdPage, fetchStoreItems } from '~/steam/store-api'

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

function errorResponse(status: number) {
  return { ok: false, status, json: async () => ({}) } as Response
}

describe('store api', () => {
  let fetchMock: jest.SpyInstance

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch')
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('skips only the failing batch and reports its ids.', async () => {
    const appIds = Array.from({ length: 250 }, (_, index) => index + 1)

    fetchMock
      .mockResolvedValueOnce(
        okResponse({ response: { store_items: [{ appid: 1 }, { appid: 2 }] } })
      )
      .mockResolvedValueOnce(errorResponse(500))

    const result = await fetchStoreItems(appIds)

    expect(result.items).toEqual([{ appid: 1 }, { appid: 2 }])
    expect(result.failedIds).toEqual(appIds.slice(200))
    expect(result.failedIds).toHaveLength(50)
  })

  it('never leaks the api key in error messages.', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(403))

    const error = await fetchAppIdPage('SECRET', 0, 10).catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).not.toContain('SECRET')
    expect(error.message).not.toContain('key=')
  })

  it('retries once after a 429 and then succeeds.', async () => {
    const sleep = jest.fn(async (_ms: number) => {})

    fetchMock
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(
        okResponse({ response: { store_items: [{ appid: 1 }] } })
      )

    const result = await fetchStoreItems([1], {
      deadline: 1_000_000,
      now: () => 0,
      sleep
    })

    expect(sleep).toHaveBeenCalledTimes(1)
    expect(sleep.mock.calls[0][0]).toBeLessThanOrEqual(10_000)
    expect(result.items).toEqual([{ appid: 1 }])
    expect(result.failedIds).toEqual([])
  })

  it('fails the batch after a second 429 without more retries.', async () => {
    const sleep = jest.fn(async (_ms: number) => {})

    fetchMock.mockResolvedValue(errorResponse(429))

    const result = await fetchStoreItems([1, 2], { now: () => 0, sleep })

    expect(sleep).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.failedIds).toEqual([1, 2])
  })

  it('does not wait for a retry that would pass the deadline.', async () => {
    const sleep = jest.fn(async (_ms: number) => {})

    fetchMock.mockResolvedValue(errorResponse(429))

    const result = await fetchStoreItems([1], {
      deadline: 5_000,
      now: () => 0,
      sleep
    })

    expect(sleep).not.toHaveBeenCalled()
    expect(result.failedIds).toEqual([1])
  })

  it('reports the remaining batches as failed once the budget is exhausted.', async () => {
    const appIds = Array.from({ length: 450 }, (_, index) => index + 1)
    let clock = 0

    fetchMock.mockImplementation(async () => {
      clock += 30_000

      return okResponse({ response: { store_items: [{ appid: 1 }] } })
    })

    const result = await fetchStoreItems(appIds, {
      deadline: 45_000,
      now: () => clock,
      sleep: async () => {}
    })

    // Two batches fit in the budget; the third is skipped unfetched.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.items).toHaveLength(2)
    expect(result.failedIds).toEqual(appIds.slice(400))
  })
})
