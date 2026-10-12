import { calculateRevenue } from '~/revenue'
import type { StoreItem } from '~/steam/types'

export interface ScrapedGame {
  gameId: number
  name: string
  description: string
  developers: string[]
  publishers: string[]
  screenshots: string[]
  tagIds: number[]
  releaseDate?: Date
  releaseYear?: number
  reviewCount: number
  percentPositive?: number
  price: number
  basePrice: number
  grossRevenue: number
}

const maxTags = 20
const screenshotBaseUrl =
  'https://shared.akamai.steamstatic.com/store_item_assets/'

export function mapStoreItem(item: StoreItem): ScrapedGame | undefined {
  const purchaseOption = item.best_purchase_option

  if (item.success !== 1 || !item.name || item.is_free || !purchaseOption) {
    return
  }

  const price = parseInt(purchaseOption.final_price_in_cents, 10)
  const basePrice = parseInt(
    purchaseOption.original_price_in_cents ??
      purchaseOption.final_price_in_cents,
    10
  )

  if (!(price > 0) || !(basePrice > 0)) {
    return
  }

  const releaseSeconds =
    item.release?.original_steam_release_date ??
    item.release?.steam_release_date
  const releaseDate = releaseSeconds
    ? new Date(releaseSeconds * 1000)
    : undefined
  const reviewCount = item.reviews?.summary_filtered?.review_count ?? 0

  return {
    gameId: item.appid ?? item.id,
    name: item.name,
    description: item.basic_info?.short_description ?? '',
    developers: item.basic_info?.developers?.map(({ name }) => name) ?? [],
    publishers: item.basic_info?.publishers?.map(({ name }) => name) ?? [],
    screenshots: [...(item.screenshots?.all_ages_screenshots ?? [])]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map(({ filename }) => `${screenshotBaseUrl}${filename}`),
    tagIds: [...(item.tags ?? [])]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxTags)
      .map(({ tagid }) => tagid),
    releaseDate,
    releaseYear: releaseDate?.getUTCFullYear(),
    reviewCount,
    percentPositive: item.reviews?.summary_filtered?.percent_positive,
    price,
    basePrice,
    grossRevenue: calculateRevenue(reviewCount, basePrice / 100)
  }
}
