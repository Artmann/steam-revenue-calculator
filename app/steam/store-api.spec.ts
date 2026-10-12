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
})
