import type { LoaderFunction } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { useRef, type ReactElement, useEffect, useState } from 'react'
import slugify from 'slugify'
import { Page } from '~/components/page'

import { fetchGames, type GameDetails } from '~/games'
import { calculateRevenue } from '~/revenue'

interface LoaderData {
  games: GameDetails[]
}

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  try {
    console.time('fetch games')
    const games = await fetchGames()
    console.timeEnd('fetch games')

    const filteredGames = games
      .filter((game) => game.price >= 100)
      .filter((game) => game.numberOfReviews >= 250)

    const seenNames = new Set()
    const uniqueGames = filteredGames.filter((game) => {
      if (!seenNames.has(game.name)) {
        seenNames.add(game.name)

        return true
      }

      return false
    })

    return { games: uniqueGames }
  } catch (error) {
    console.error(error)

    return { games: [] }
  }
}

interface GameWithRevenue extends GameDetails {
  grossRevenue: number
}

export default function GamesRoute(): ReactElement {
  const { games } = useLoaderData<LoaderData>()

  const gamesWithRevenue = games.map((game) => ({
    ...game,
    grossRevenue: calculateRevenue(game.numberOfReviews, game.price / 100)
  }))

  const filteredGames = gamesWithRevenue

  //  const genres = [...new Set(filteredGames.flatMap((g) => g.genres))]

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

        <div className="flex flex-col gap-8">
          <GameSection
            title="Over 100 million"
            games={filteredGames}
            min={100_000_000}
            max={Infinity}
          />
          <GameSection
            title="Over 50 million"
            games={filteredGames}
            min={50_000_000}
            max={100_000_000}
          />
          <GameSection
            title="Over 25 million"
            games={filteredGames}
            min={25_000_000}
            max={50_000_000}
          />
          <GameSection
            title="Over 1 million"
            games={filteredGames}
            min={1_000_000}
            max={25_000_000}
          />
          <GameSection
            title="Over $500,000"
            games={filteredGames}
            min={500_000}
            max={1_000_000}
          />
          <GameSection
            title="Over $100,000"
            games={filteredGames}
            min={100_000}
            max={500_000}
          />
          <GameSection
            title="Over $50,000"
            games={filteredGames}
            min={50_000}
            max={100_000}
          />
          <GameSection
            title="Over $1,000"
            games={filteredGames}
            min={1_000}
            max={50_000}
          />
        </div>
      </div>
    </Page>
  )
}

function GameSection({
  title,
  games,
  min,
  max
}: {
  title: string
  games: GameWithRevenue[]
  min: number
  max: number
}): ReactElement | null {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const filteredGames = games
    .filter((game) => game.grossRevenue >= min && game.grossRevenue < max)
    .sort((a, b) => (a.grossRevenue > b.grossRevenue ? -1 : 1))

  if (filteredGames.length === 0) {
    return null
  }

  return (
    <div className="w-full">
      <div
        className="flex pointer-cursor items-center gap-4 mb-8"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div>
          <h2
            className="text-3xl pointer-cursor block"
            id={slugify(title, { lower: true })}
          >
            {title}
          </h2>
        </div>

        <div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-white h-4 w-4"
            viewBox="0 0 24 24"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isCollapsed ? (
              <>
                <path
                  stroke="none"
                  d="M0 0h24v24H0z"
                  fill="none"
                ></path>
                <path d="M6 15l6 -6l6 6"></path>
              </>
            ) : (
              <>
                <path
                  stroke="none"
                  d="M0 0h24v24H0z"
                  fill="none"
                ></path>
                <path d="M6 9l6 6l6 -6"></path>
              </>
            )}
          </svg>
        </div>
      </div>
      {!isCollapsed && (
        <div className="flex flex-wrap gap-8">
          {filteredGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GameCard({ game }: { game: GameWithRevenue }): ReactElement {
  const slug = slugify(game.name, { lower: true })

  return (
    <div className="mb-8 w-48">
      <div>
        <Link to={`/app/${game.id}/${slug}`}>
          <GameImage
            id={game.id}
            name={game.name}
            price={game.price}
          />
        </Link>
      </div>
      <div className="py-4 text-sm w-full flex flex-col gap-2">
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
          {new Intl.NumberFormat('en-US').format(Math.round(game.grossRevenue))}
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
  )
}

function GameImage({
  id,
  name,
  price
}: {
  id: number
  name: string
  price: number
}): ReactElement {
  const ref = useRef<HTMLImageElement>(null)
  const url = `https://cdn.akamai.steamstatic.com/steam/apps/${id}/hero_capsule.jpg?t=${Date.now()}`

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
        relative w-48 h-auto
        transition-transform duration-400 ease-in-out transform hover:scale-110
        overflow-hidden
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
