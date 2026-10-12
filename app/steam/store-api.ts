import type { SteamTag, StoreItem } from '~/steam/types'

export interface AppIdPage {
  appIds: number[]
  lastAppId: number
  haveMoreResults: boolean
}

export interface StoreItemsResult {
  items: StoreItem[]
  failedIds: number[]
}

// GetItems accepts ~250 ids before the GET URL gets too long; stay below it.
const storeItemsBatchSize = 200
const maxAttempts = 3
const rateLimitDelayMs = 30_000

export async function fetchAppIdPage(
  apiKey: string,
  lastAppId: number,
  maxResults: number
): Promise<AppIdPage> {
  const params = new URLSearchParams({
    key: apiKey,
    include_games: 'true',
    last_appid: String(lastAppId),
    max_results: String(maxResults)
  })

  const data = await getJson<{
    response: {
      apps?: { appid: number }[]
      have_more_results?: boolean
      last_appid?: number
    }
  }>(`https://api.steampowered.com/IStoreService/GetAppList/v1/?${params}`)

  const apps = data.response.apps ?? []

  return {
    appIds: apps.map(({ appid }) => appid),
    lastAppId: data.response.last_appid ?? apps[apps.length - 1]?.appid ?? 0,
    haveMoreResults: Boolean(data.response.have_more_results)
  }
}

export async function fetchStoreItems(appIds: number[]): Promise<StoreItemsResult> {
  const items: StoreItem[] = []
  const failedIds: number[] = []

  for (let start = 0; start < appIds.length; start += storeItemsBatchSize) {
    const batch = appIds.slice(start, start + storeItemsBatchSize)

    const input = {
      ids: batch.map((appid) => ({ appid })),
      context: { language: 'english', country_code: 'US' },
      data_request: {
        include_basic_info: true,
        include_release: true,
        include_reviews: true,
        include_screenshots: true,
        include_tag_count: 20
      }
    }

    try {
      const data = await getJson<{ response: { store_items?: StoreItem[] } }>(
        `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(
          JSON.stringify(input)
        )}`
      )

      items.push(...(data.response.store_items ?? []))
    } catch (error) {
      // Skip just this batch rather than losing the whole page.
      console.error(
        `Failed to fetch store items for ${batch.length} ids starting at app id ${batch[0]}.`
      )
      console.error(error)

      failedIds.push(...batch)
    }
  }

  return { items, failedIds }
}

export async function fetchTagList(): Promise<SteamTag[]> {
  const data = await getJson<{ response: { tags?: SteamTag[] } }>(
    'https://api.steampowered.com/IStoreService/GetTagList/v1/?language=english'
  )

  return data.response.tags ?? []
}

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  const response = await fetch(url)

  if (response.status === 429 && attempt < maxAttempts) {
    console.log('Rate limited by Steam. Waiting 30 seconds...')

    await new Promise((resolve) => setTimeout(resolve, rateLimitDelayMs))

    return getJson(url, attempt + 1)
  }

  if (!response.ok) {
    // Strip the query string so the API key never reaches the logs.
    throw new Error(
      `Steam request failed with ${response.status}: ${url.split('?')[0]}`
    )
  }

  return (await response.json()) as T
}
