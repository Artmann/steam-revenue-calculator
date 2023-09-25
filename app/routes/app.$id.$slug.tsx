import { LoaderFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { ReactElement } from 'react'
import { Page } from '~/components/page'

import { GameDetails, fetchGames, formatCurrency } from '~/games'
import { calculateRevenue, revenueBreakdown } from '~/revenue'
import { RevenueBreakdownTable } from '~/revenue/revenue-breakdown-table'

interface LoaderData {
  game: GameDetails
}

export const loader: LoaderFunction = async ({ params }) => {
  const gameId = parseInt(params.id as string, 10)

  const games = await fetchGames()
  const game = games.find((game) => game.id === gameId)

  if (!game) {
    throw new Response(null, {
      status: 404,
      statusText: 'Game Not Found.'
    })
  }

  return {
    game
  }
}

export default function AppRoute(): ReactElement {
  const { game } = useLoaderData<LoaderData>()

  const grossRevenue = calculateRevenue(game.numberOfReviews, game.price / 100)
  const breakdown = revenueBreakdown(grossRevenue)

  return (
    <Page>
      <div className=" flex flex-col gap-8">
        <div>
          <h1
            className="text-4xl"
            data-testid="title"
          >
            {game.name}
          </h1>
        </div>

        <div className="flex flex-col gap-8 md:flex-row md:gap-16">
          <div className="md:flex-1 max-w-lg">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <img
                  alt={game.name}
                  className="w-full h-auto aspect-video shadow-lg block"
                  src={game.screenshots[0]}
                />
                <div className="text-slate-300 text-xs">
                  By:{' '}
                  {[...new Set([...game.developers, ...game.publishers])].join(
                    ', '
                  )}
                </div>
              </div>

              <div data-testid="description">{game.description}</div>
              <div className="flex gap-8 md:gap-16">
                <div>
                  <div className="uppercase font-bold text-xs text-slate-300">
                    Price
                  </div>
                  <div className="font-bold text-lg">
                    {formatCurrency(game.price / 100)}
                  </div>
                </div>
                <div>
                  <div className="uppercase font-bold text-xs text-slate-300">
                    Reviews
                  </div>
                  <div className="font-bold text-lg">
                    {new Intl.NumberFormat('en-US').format(
                      game.numberOfReviews
                    )}
                  </div>
                </div>
                {game.metacritic && (
                  <div>
                    <div className="uppercase font-bold text-xs text-slate-300">
                      Metacritic
                    </div>
                    <div className="font-bold text-lg">
                      <a
                        href={game.metacritic.url}
                        rel="noopener"
                        target="_blank"
                      >
                        {game.metacritic.score}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <RevenueBreakdownTable breakdown={breakdown} />
          </div>
        </div>
      </div>
    </Page>
  )
}
