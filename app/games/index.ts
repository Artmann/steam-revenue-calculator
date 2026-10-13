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
