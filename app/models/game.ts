import { BaseModel } from 'esix'
import { GameDetails } from '~/games'

export class Game extends BaseModel {
  details?: GameDetails
  gameId = 0
  grossRevenue = 0
  slug = ''
}
