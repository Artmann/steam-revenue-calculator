import { RetryableError } from 'workflow'

import { encodeGetItemsRequest } from '~/steam/get-items-request'
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

// An id below 2^28 takes 7 protobuf bytes, so 700 ids keep the GetItems URL
// near 7 KB, under Steam's ~8 KB limit.
const storeItemsBatchSize = 700
// A hung Steam call must not hold a step open indefinitely.
const requestTimeoutMs = 30_000

function rateLimitRetryAfterMs(): number {
  // Tests shorten the wait; production waits a minute before the step retries.
  const configured = Number(process.env.STEAM_RATE_LIMIT_RETRY_AFTER_MS)

  return configured > 0 ? configured : 60_000
}

function rateLimitBackoffMs(): number {
  // Tests shorten the wait; production starts at 5 s and doubles.
  const configured = Number(process.env.STEAM_RATE_LIMIT_BACKOFF_MS)

  return configured > 0 ? configured : 5_000
}

// Waits of 5, 10 and 20 s before the step gives up and retries in a minute.
const rateLimitBackoffAttempts = 3

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
    // Fall back to the requested cursor so an empty page never rewinds to 0.
    lastAppId:
      data.response.last_appid ?? apps[apps.length - 1]?.appid ?? lastAppId,
    haveMoreResults: Boolean(data.response.have_more_results)
  }
}

export async function fetchStoreItems(
  appIds: number[]
): Promise<StoreItemsResult> {
  const items: StoreItem[] = []
  const failedIds: number[] = []

  for (let start = 0; start < appIds.length; start += storeItemsBatchSize) {
    const batch = appIds.slice(start, start + storeItemsBatchSize)

    try {
      const data = await getItemsWithBackoff(batch)

      items.push(...(data.response.store_items ?? []))
    } catch (error) {
      // A rate limit that outlasts the backoff fails the whole step so the
      // runtime retries it later.
      if (RetryableError.is(error)) {
        throw error
      }

      // Skip just this batch rather than losing the whole chunk.
      console.error(
        `Failed to fetch store items for ${batch.length} ids starting at app id ${batch[0]}.`
      )
      console.error(error)

      failedIds.push(...batch)
    }
  }

  return { items, failedIds }
}

async function getItemsWithBackoff(
  appIds: number[]
): Promise<{ response: { store_items?: StoreItem[] } }> {
  const params = new URLSearchParams({
    input_protobuf_encoded: encodeGetItemsRequest(appIds),
    format: 'json'
  })
  const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?${params}`

  for (let attempt = 0; ; attempt++) {
    try {
      return await getJson(url)
    } catch (error) {
      // Retrying just this batch keeps the batches already fetched, which a
      // step retry would throw away and fetch again.
      if (!RetryableError.is(error) || attempt >= rateLimitBackoffAttempts) {
        throw error
      }

      await new Promise((resolve) =>
        setTimeout(resolve, rateLimitBackoffMs() * 2 ** attempt)
      )
    }
  }
}

export async function fetchTagList(): Promise<SteamTag[]> {
  const data = await getJson<{ response: { tags?: SteamTag[] } }>(
    'https://api.steampowered.com/IStoreService/GetTagList/v1/?language=english'
  )

  return data.response.tags ?? []
}

async function getJson<T>(url: string): Promise<T> {
  // Strip the query string so the API key never reaches the logs.
  const endpoint = url.split('?')[0]

  const response = await fetch(url, {
    signal: AbortSignal.timeout(requestTimeoutMs)
  })

  if (response.status === 429) {
    throw new RetryableError(`Steam rate limited the request: ${endpoint}`, {
      retryAfter: rateLimitRetryAfterMs()
    })
  }

  if (!response.ok) {
    throw new Error(`Steam request failed with ${response.status}: ${endpoint}`)
  }

  return (await response.json()) as T
}
