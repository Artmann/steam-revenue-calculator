import type { LoaderFunction } from '@remix-run/node'
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
import { type GameDetails } from '~/games'
import { Game } from '~/models/game'
import { calculateRevenue } from '~/revenue'
import { GameService } from '~/services/game-service.server'

interface LoaderData {
  games: GameDetails[]
  page: number
  pageCount: number
  timestamp: number
}

export const loader: LoaderFunction = async ({
  request
}): Promise<LoaderData> => {
  const pageSize = 48
  const timestamp = Date.now()

  try {
    const params = new URL(request.url).searchParams

    const page = parseInt(params.get('page') ?? '1', 10)
    const gameCount = await Game.orderBy('grossRevenue', 'desc').count()
    const pageCount = Math.ceil(gameCount / pageSize)

    const gameService = new GameService()
    const games = await gameService.listGames(page, pageSize)

    return { games, page, pageCount, timestamp }
  } catch (error) {
    console.error(error)

    return { games: [], page: 1, pageCount: 1, timestamp }
  }
}

interface GameWithRevenue extends GameDetails {
  grossRevenue: number
}

export default function GamesRoute(): ReactElement {
  const { games, page, pageCount, timestamp } = useLoaderData<LoaderData>()

  const gamesWithRevenue = games.map((game) => ({
    ...game,
    grossRevenue: calculateRevenue(game.numberOfReviews, game.price / 100)
  }))

  const previousPageNumber = Math.max(page - 1, 1)
  const nextPageNumber = page + 1

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
      <div className="flex flex-col gap-8">
        <h1 className="text-4xl">Games</h1>

        <div className="w-full">
          Here, we've compiled a list of games along with their estimated
          revenue figures. Our estimations are based on various metrics like
          sales volume, current market trends, and user reviews. While we strive
          to be as accurate as possible, it's important to note that these
          figures are approximations and might not represent the exact revenue
          earned by the developers or publishers. Dive in and explore how your
          favorite games might be performing on Steam!
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {gamesWithRevenue.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              timestamp={timestamp}
            />
          ))}
        </div>
        <div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  className="text-white"
                  href={`/games?page=${previousPageNumber}`}
                />
              </PaginationItem>

              {pageNumbers.map((pageNumber) => (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    className={
                      page === pageNumber ? 'text-gray-700' : 'text-white'
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
                  className="text-white"
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

function GameCard({
  game,
  timestamp
}: {
  game: GameWithRevenue
  timestamp: number
}): ReactElement {
  const slug = slugify(game.name, { lower: true })

  return (
    <div className="mb-8 md:mb-16 mx-auto w-full md:w-48 space-y-4">
      <div>
        <Link to={`/app/${game.id}/${slug}`}>
          <GameImage
            id={game.id}
            name={game.name}
            price={game.price}
            timestamp={timestamp}
          />
        </Link>
      </div>
      <div className="space-y-1">
        <div className="text-sm w-full flex flex-col gap-2">
          <Link
            className="font-medium truncate w-full block"
            title={game.name}
            to={`/app/${game.id}/${slug}`}
          >
            {game.name}
          </Link>
        </div>
        <div className="flex items-center text-xs">
          <div className="flex-1">
            $
            {new Intl.NumberFormat('en-US').format(
              Math.round(game.grossRevenue)
            )}
          </div>
          <div>
            <Link to={`https://store.steampowered.com/app/${game.id}`}>
              <img
                className="w-4 h-4"
                alt="Steam"
                loading="lazy"
                src="/images/steam.png"
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function GameImage({
  id,
  name,
  price,
  timestamp
}: {
  id: number
  name: string
  price: number
  timestamp: number
}): ReactElement {
  const ref = useRef<HTMLImageElement>(null)
  const url = `https://cdn.akamai.steamstatic.com/steam/apps/${id}/hero_capsule.jpg?t=${timestamp}`

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
    <div
      className={`
        relative w-full h-auto
        overflow-hidden
        rounded-md
      `}
      style={{ aspectRatio: '192 / 230' }}
    >
      <img
        ref={ref}
        alt={name}
        className={`
          absolute inset-0 object-cover
          shadow-md
        `}
        loading="lazy"
        src={url}
      />
      <div className="absolute bottom-0 left-0 right-0 p-2 text-xs bg-black z-10 text-white bg-opacity-80">
        ${(price / 100).toFixed(2)}
      </div>
    </div>
  )
}
