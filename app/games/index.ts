import slugify from 'slugify'

export interface GameDetails {
  id: number
  categories: string[]

  description: string
  developers: string[]
  genres: string[]
  metacritic: {
    score?: number
    url?: string
  }
  name: string
  numberOfReviews: number
  publishers: string[]
  price: number
  screenshots: string[]
}

// Older game records can have null or missing fields, so fill in safe
// defaults before the game page renders them.
export function normalizeGameDetails(
  details: Partial<GameDetails>,
  gameId: number
): GameDetails {
  return {
    id: details.id ?? gameId,
    categories: details.categories ?? [],
    description: details.description ?? '',
    developers: details.developers ?? [],
    genres: details.genres ?? [],
    metacritic: details.metacritic ?? {},
    name: details.name ?? '',
    numberOfReviews: details.numberOfReviews ?? 0,
    publishers: details.publishers ?? [],
    price: details.price ?? 0,
    screenshots: details.screenshots ?? []
  }
}

export function createGameSlug(name: string): string {
  return slugify(name, {
    lower: true
  })
}

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const roundedCurrencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
})

const numberFormat = new Intl.NumberFormat('en-US')

export const formatCurrency = (amount: number, rounded: boolean = false) =>
  rounded
    ? roundedCurrencyFormat.format(Math.round(amount))
    : currencyFormat.format(amount)

export const formatNumber = (value: number) => numberFormat.format(value)
