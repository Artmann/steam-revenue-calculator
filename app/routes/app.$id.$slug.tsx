import type { HeadersFunction, LoaderFunction, MetaFunction } from 'react-router'
import { Link, useLoaderData } from 'react-router'
import type { ReactElement } from 'react'
import slugify from 'slugify'

import { Page } from '~/components/page'
import type { GameDetails } from '~/games'
import { formatCurrency } from '~/games'
import { getTagIndex, type TagIndexEntry } from '~/market/market-service.server'
import { Game } from '~/models/game'
import { calculateRevenue, revenueBreakdown } from '~/revenue'
import { RevenueBreakdownTable } from '~/revenue/revenue-breakdown-table'

interface LoaderData {
  game: GameDetails
  tags: TagIndexEntry[]
}

export const headers: HeadersFunction = () => {
  return {
    'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800'
  }
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

  const tagIndex = await getTagIndex()
  const tagsById = new Map(tagIndex.map((tag) => [tag.tagId, tag]))

  return {
    game: game.details,
    tags: (game.tagIds ?? []).flatMap((tagId) => {
      const tag = tagsById.get(tagId)

      return tag ? [tag] : []
    })
  }
}

export const meta: MetaFunction = ({ data: loaderData }) => {
  const data = loaderData as LoaderData

  return [
    {
      title: `${data.game.name} — Steam Revenue Calculator`
    },
    {
      property: 'og:title',
      content: `${data.game.name} — Steam Revenue Calculator`
    },
    {
      name: 'description',
      content: `${data.game.name} on Steam — estimated revenue, sales data, and financial breakdown. See gross revenue, net revenue, and review-based calculations for this game.`
    },
    {
      property: 'og:image',
      content: data.game.screenshots[0]
    },
    {
      property: 'og:description',
      content: `${data.game.name} on Steam — estimated revenue, sales data, and financial breakdown. See gross revenue, net revenue, and review-based calculations for this game.`
    },
    {
      name: 'og:url',
      content: `https://steam-revenue-calculator.com/app/${
        data.game.id
      }/${slugify(data.game.name, {
        lower: true
      })}`
    },
    {
      tagName: 'link',
      rel: 'canonical',
      href: data.game.id
        ? `https://steam-revenue-calculator.com/app/${data.game.id}/${slugify(data.game.name, { lower: true })}`
        : 'https://steam-revenue-calculator.com/games'
    },
    {
      tagName: 'link',
      rel: 'preload',
      href: data.game.screenshots[0],
      as: 'image',
      fetchpriority: 'high'
    }
  ]
}

export default function AppRoute(): ReactElement {
  const { game, tags = [] } = useLoaderData<LoaderData>()

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
                  width={616}
                  height={347}
                  src={game.screenshots[0]}
                />
                <div className="text-paper-muted text-sm">
                  <span className="eyebrow mr-2">By</span>
                  {[...new Set([...game.developers, ...game.publishers])].join(
                    ', '
                  )}
                </div>
                {tags.length > 0 && (
                  <ul
                    className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
                    data-testid="tags"
                  >
                    {tags.map((tag) => (
                      <li key={tag.tagId}>
                        {tag.hasPage ? (
                          <Link
                            className="text-accent hover:text-accent-strong underline underline-offset-4"
                            to={`/tags/${tag.slug}`}
                          >
                            {tag.name}
                          </Link>
                        ) : (
                          <span className="text-paper-muted">{tag.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div data-testid="description">{game.description}</div>
              <div className="flex gap-10 md:gap-14 border-y border-rule py-4">
                <div className="space-y-1.5">
                  <div className="eyebrow">Price</div>
                  <div className="font-display text-xl tabular-nums">
                    {formatCurrency(game.price / 100)}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="eyebrow">Reviews</div>
                  <div className="font-display text-xl tabular-nums">
                    {new Intl.NumberFormat('en-US').format(
                      game.numberOfReviews
                    )}
                  </div>
                </div>
                {game.metacritic?.score && (
                  <div className="space-y-1.5">
                    <div className="eyebrow">Metacritic</div>
                    <div className="font-display text-xl tabular-nums">
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
                  className="text-sm text-accent hover:text-accent-strong underline underline-offset-4 hover:decoration-accent"
                  to={`https://store.steampowered.com/app/${game.id}`}
                >
                  View on Steam →
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
