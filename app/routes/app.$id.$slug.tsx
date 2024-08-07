import type { LoaderFunction, V2_MetaFunction } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import type { ReactElement } from 'react'
import slugify from 'slugify'

import { Page } from '~/components/page'
import type { GameDetails } from '~/games'
import { formatCurrency } from '~/games'
import { Game } from '~/models/game'
import { calculateRevenue, revenueBreakdown } from '~/revenue'
import { RevenueBreakdownTable } from '~/revenue/revenue-breakdown-table'

interface LoaderData {
  game: GameDetails
}

export const loader: LoaderFunction = async ({
  params
}): Promise<LoaderData | Response> => {
  const gameId = parseInt(params.id as string, 10)

  const game = await Game.findBy('gameId', gameId)

  if (!game) {
    throw new Response(null, {
      status: 404,
      statusText: 'Game Not Found.'
    })
  }

  if (!game.details) {
    throw new Response(null, {
      status: 404,
      statusText: 'Game Not Found.'
    })
  }

  return {
    game: game.details
  }
}

export const meta: V2_MetaFunction = ({ data }) => {
  return [
    {
      title: data.game.name
    },
    {
      property: 'og:title',
      content: data.game.name
    },
    {
      name: 'description',
      content: data.game.description
    },
    {
      name: 'og:image',
      content: data.game.screenshots[0]
    },
    {
      name: 'og:url',
      content: `https://steam-revenue-calculator.com/app/${
        data.game.id
      }/${slugify(data.game.name, {
        lower: true
      })}`
    }
  ]
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
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {game.metacritic.score}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Link
                  className="text-xs hover:underline"
                  to={`https://store.steampowered.com/app/${game.id}`}
                >
                  View on Steam
                </Link>
              </div>

              <div className="mt-4">
                <h2 className="mb-2 text-xl">
                  How much money did {game.name} make?
                </h2>
                <div>
                  We estimate that {game.name} made{' '}
                  {formatCurrency(grossRevenue)}
                  in gross revenue since its release. Out of this, the developer
                  had an estimated net revenue of{' '}
                  {formatCurrency(breakdown.netRevenue)}. Refer to the revenue
                  table for a full breakdown of these numbers.
                </div>
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
