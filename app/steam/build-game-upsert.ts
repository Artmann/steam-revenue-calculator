import { createGameSlug } from '~/games'
import type { ScrapedGame } from '~/steam/map-store-item'

export interface GameUpsertOperation {
  updateOne: {
    filter: { gameId: number }
    update: {
      $set: Record<string, unknown>
      $unset?: Record<string, ''>
      $setOnInsert: Record<string, unknown>
    }
    upsert: true
  }
}

export function buildGameUpsert(
  game: ScrapedGame,
  now: number,
  newId: string,
  listedAt: number
): GameUpsertOperation {
  const fields: Record<string, unknown> = {
    slug: createGameSlug(game.name),
    grossRevenue: game.grossRevenue,
    tagIds: game.tagIds,
    releaseDate: game.releaseDate,
    releaseYear: game.releaseYear,
    reviewCount: game.reviewCount,
    percentPositive: game.percentPositive,
    price: game.price,
    basePrice: game.basePrice,
    updatedAt: now,
    listedAt,
    'details.id': game.gameId,
    'details.name': game.name,
    'details.description': game.description,
    'details.developers': game.developers,
    'details.publishers': game.publishers,
    'details.screenshots': game.screenshots,
    // The game page recomputes revenue from these two, so they must match grossRevenue.
    'details.price': game.basePrice,
    'details.numberOfReviews': game.reviewCount
  }

  const entries = Object.entries(fields)
  const $set = Object.fromEntries(
    entries.filter(([, value]) => value !== undefined)
  )
  // Clear values Steam no longer reports, so a rescrape never keeps stale data.
  const $unset = Object.fromEntries(
    entries
      .filter(([, value]) => value === undefined)
      .map(([key]) => [key, ''] as const)
  )

  return {
    updateOne: {
      filter: { gameId: game.gameId },
      update: {
        $set,
        ...(Object.keys($unset).length > 0 ? { $unset } : {}),
        $setOnInsert: {
          _id: newId,
          createdAt: now,
          'details.categories': [],
          'details.genres': [],
          'details.metacritic': {}
        }
      },
      upsert: true
    }
  }
}
