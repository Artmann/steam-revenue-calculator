import { BaseModel } from 'esix'
import type { GameDetails } from '~/games'

export class Game extends BaseModel {
  details?: GameDetails
  gameId = 0
  grossRevenue = 0
  slug = ''
}
