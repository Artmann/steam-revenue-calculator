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

// What the game page renders. It shows one screenshot and no categories or
// genres, so the loader leaves those out of the HTML's hydration payload.
export type GamePageDetails = Omit<
  GameDetails,
  'categories' | 'genres' | 'screenshots'
> & {
  screenshot: string | null
}

// Older game records can have null or missing fields, so fill in safe
// defaults before the game page renders them.
export function toGamePageDetails(
  details: Partial<GameDetails>,
  gameId: number
): GamePageDetails {
  return {
    id: details.id ?? gameId,
    description: details.description ?? '',
    developers: details.developers ?? [],
    metacritic: details.metacritic ?? {},
    name: details.name ?? '',
    numberOfReviews: details.numberOfReviews ?? 0,
    publishers: details.publishers ?? [],
    price: details.price ?? 0,
    screenshot: details.screenshots?.[0] ?? null
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
