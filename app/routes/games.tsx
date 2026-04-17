import type { HeadersFunction, LoaderFunction, V2_MetaFunction } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { useRef, type ReactElement, useEffect, useMemo } from 'react'
import slugify from 'slugify'

import { Page } from '~/components/page'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '~/components/ui/pagination'
import { type GameDetails, formatCurrency } from '~/games'
import { GameService } from '~/services/game-service.server'

interface GameWithRevenue extends GameDetails {
  grossRevenue: number
}

interface LoaderData {
  games: GameWithRevenue[]
  page: number
  pageCount: number
  totalCount: number
}

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: 'Steam Games Ranked by Revenue — Steam Revenue Calculator'
    },
    {
      name: 'description',
      content: 'Browse our database of Steam games ranked by estimated revenue. See which PC games earn the most on Steam, with detailed revenue breakdowns for each game.'
    },
    {
      property: 'og:title',
      content: 'Steam Games Ranked by Revenue — Steam Revenue Calculator'
    },
    {
      property: 'og:description',
      content: 'Browse our database of Steam games ranked by estimated revenue. See which PC games earn the most on Steam, with detailed revenue breakdowns for each game.'
    },
    {
      property: 'og:url',
      content: 'https://steam-revenue-calculator.com/games'
    },
    {
      tagName: 'link',
      rel: 'canonical',
      href: 'https://steam-revenue-calculator.com/games'
    }
  ]
}

export const headers: HeadersFunction = () => {
  return {
    'Cache-Control': 'public, max-age=300, s-maxage=3600'
  }
}

export const loader: LoaderFunction = async ({
  request
}): Promise<LoaderData> => {
  const pageSize = 48

  try {
    const params = new URL(request.url).searchParams

    const page = parseInt(params.get('page') ?? '1', 10)
    const gameService = new GameService()
    const totalCount = await gameService.getGameCount()
    const pageCount = Math.ceil(totalCount / pageSize)

    const games = await gameService.listGames(page, pageSize)

    return { games, page, pageCount, totalCount }
  } catch (error) {
    console.error(error)

    return { games: [], page: 1, pageCount: 1, totalCount: 0 }
  }
}

export default function GamesRoute(): ReactElement {
  const { games, page, pageCount, totalCount } = useLoaderData<LoaderData>()

  const previousPageNumber = Math.max(page - 1, 1)
  const nextPageNumber = page + 1
  const pageSize = 48
  const startRank = (page - 1) * pageSize + 1

  const pageNumbers = useMemo(() => {
    const startNumber = Math.max(page - 2, 1)
    const endNumber = Math.min(page + 2, pageCount)

    return Array.from(
      { length: endNumber - startNumber + 1 },
      (_, index) => startNumber + index
    )
  }, [page, pageCount])

  return (
    <Page>
      <div className="flex flex-col gap-12">
        <header className="flex flex-col gap-6 pt-4 md:pt-10 max-w-2xl">
          <div className="eyebrow">League table</div>
          <h1 className="font-display leading-[1.02]">Steam games by revenue</h1>
          <p className="text-lg text-paper-muted max-w-xl">
            {new Intl.NumberFormat('en-US').format(totalCount)} titles, ranked
            by estimated gross revenue from the{' '}
            <em className="text-accent not-italic">Boxleiter</em> method. Click
            a row for the full breakdown.
          </p>
        </header>

        <section>
          <div className="hidden md:grid md:grid-cols-[3rem_5rem_1fr_8rem] gap-6 items-baseline eyebrow pb-3 border-b border-rule-strong">
            <div className="text-right">#</div>
            <div></div>
            <div>Title</div>
            <div className="text-right">Est. gross</div>
          </div>

          <div className="divide-y divide-rule">
            {games.map((game, index) => (
              <GameRow
                key={game.id}
                rank={startRank + index}
                game={game}
              />
            ))}
          </div>
        </section>

        <div className="pt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  className="text-paper hover:text-accent"
                  href={`/games?page=${previousPageNumber}`}
                />
              </PaginationItem>

              {pageNumbers.map((pageNumber) => (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    className={
                      page === pageNumber
                        ? 'text-accent font-display'
                        : 'text-paper-muted hover:text-paper'
                    }
                    href={`/games?page=${pageNumber}`}
                    isActive={page === pageNumber}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  className="text-paper hover:text-accent"
                  href={`/games?page=${nextPageNumber}`}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </Page>
  )
}

function GameRow({
  rank,
  game
}: {
  rank: number
  game: GameWithRevenue
}): ReactElement {
  const slug = slugify(game.name, { lower: true })
  const detailHref = `/app/${game.id}/${slug}`

  return (
    <Link
      to={detailHref}
      className="group grid grid-cols-[2rem_1fr_auto] md:grid-cols-[3rem_5rem_1fr_8rem] gap-4 md:gap-6 items-center py-3 hover:bg-paper/[0.02] transition-colors"
    >
      <div className="font-display text-paper-muted tabular-nums text-right text-sm md:text-base">
        {String(rank).padStart(3, '0')}
      </div>
      <div className="hidden md:block">
        <GameImage
          id={game.id}
          name={game.name}
        />
      </div>
      <div className="min-w-0 flex items-baseline gap-3">
        <div className="font-display text-base md:text-lg leading-tight group-hover:text-accent truncate">
          {game.name}
        </div>
        <div className="hidden md:inline text-xs text-paper-dim tabular-nums shrink-0">
          ${(game.price / 100).toFixed(2)}
        </div>
      </div>
      <div className="text-right font-display text-base md:text-lg tabular-nums">
        {formatCurrency(Math.round(game.grossRevenue), true)}
      </div>
    </Link>
  )
}

function GameImage({
  id,
  name
}: {
  id: number
  name: string
}): ReactElement {
  const ref = useRef<HTMLImageElement>(null)
  const url = `https://cdn.akamai.steamstatic.com/steam/apps/${id}/capsule_184x69.jpg`

  useEffect(() => {
    if (!ref.current) {
      return
    }

    const errorHandler = () => {
      ref.current!.src = '/images/game-placeholder.png'
      ref.current!.onerror = null
    }

    ref.current.onerror = errorHandler
  }, [id])

  return (
    <img
      ref={ref}
      alt={name}
      className="w-20 h-auto"
      loading="lazy"
      src={url}
    />
  )
}
