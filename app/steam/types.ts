export interface StoreTag {
  tagid: number
  weight: number
}

export interface StoreItem {
  id: number
  appid?: number
  success: number
  name?: string
  is_free?: boolean
  tags?: StoreTag[]
  reviews?: {
    summary_filtered?: {
      review_count: number
      percent_positive: number
    }
  }
  release?: {
    steam_release_date?: number
    original_steam_release_date?: number
  }
  basic_info?: {
    short_description?: string
    developers?: { name: string }[]
    publishers?: { name: string }[]
  }
  best_purchase_option?: {
    final_price_in_cents: string
    original_price_in_cents?: string
  }
  screenshots?: {
    all_ages_screenshots?: { filename: string; ordinal: number }[]
  }
}

export interface SteamTag {
  tagid: number
  name: string
}
