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

let games: GameDetails[] | undefined

export async function fetchGames(): Promise<GameDetails[]> {
  if (games) {
    return games
  }

  const response = await fetch(
    'https://steam-revenue-calculator.s3.amazonaws.com/games-filtered.json'
  )

  games = (await response.json()) as GameDetails[]

  return games
}

export const formatCurrency = (amount: number, rounded: boolean = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: rounded ? 0 : 2,
    maximumFractionDigits: 2
  }).format(rounded ? Math.round(amount) : amount)
