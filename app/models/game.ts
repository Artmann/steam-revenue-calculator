import { BaseModel } from 'esix'
import type { GameDetails } from '~/games'

export class Game extends BaseModel {
  details?: GameDetails
  gameId = 0
  grossRevenue = 0
  slug = ''

  basePrice?: number
  percentPositive?: number
  price?: number
  releaseDate?: Date
  releaseYear?: number
  reviewCount?: number
  tagIds?: number[]
}
