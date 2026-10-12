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

export function createGameSlug(name: string): string {
  return slugify(name, {
    lower: true
  })
}

export const formatCurrency = (amount: number, rounded: boolean = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: rounded ? 0 : 2,
    maximumFractionDigits: 2
  }).format(rounded ? Math.round(amount) : amount)
