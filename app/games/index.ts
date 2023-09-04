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