import type { MarketGame } from '~/market/stats'

export interface MarketGameDocument {
  gameId: number
  slug: string
  grossRevenue: number
  basePrice?: number
  releaseYear?: number
  tagIds?: number[]
  reviewCount?: number
  details?: {
    name?: string
    developers?: string[]
    publishers?: string[]
  }
}

export const MARKET_GAME_PROJECTION = {
  _id: 0,
  gameId: 1,
  slug: 1,
  grossRevenue: 1,
  basePrice: 1,
  releaseYear: 1,
  tagIds: 1,
  reviewCount: 1,
  'details.name': 1,
  'details.developers': 1,
  'details.publishers': 1
}

export function toMarketGame(document: MarketGameDocument): MarketGame {
  return {
    gameId: document.gameId,
    name: document.details?.name ?? '',
    slug: document.slug,
    grossRevenue: document.grossRevenue,
    basePrice: document.basePrice ?? 0,
    releaseYear: document.releaseYear,
    tagIds: document.tagIds ?? [],
    reviewCount: document.reviewCount ?? 0,
    developers: document.details?.developers ?? [],
    publishers: document.details?.publishers ?? []
  }
}
