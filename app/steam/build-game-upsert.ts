import { createGameSlug } from '~/games'
import type { ScrapedGame } from '~/steam/map-store-item'

export interface GameUpsertOperation {
  updateOne: {
    filter: { gameId: number }
    update: {
      $set: Record<string, unknown>
      $setOnInsert: Record<string, unknown>
    }
    upsert: true
  }
}

export function buildGameUpsert(
  game: ScrapedGame,
  now: number,
  newId: string
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

  const $set = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  )

  return {
    updateOne: {
      filter: { gameId: game.gameId },
      update: {
        $set,
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
