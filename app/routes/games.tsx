import type { LoaderFunction } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import fs from 'fs'
import { useRef, type ReactElement, useEffect } from 'react'
import slugify from 'slugify'

import type { GameDetails } from '~/games'
import { calculateRevenue } from '~/revenue'

interface LoaderData {
  games: GameDetails[]
}

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const raw = await fs.promises.readFile('./data/games-filtered.json', 'utf-8')
  const games = JSON.parse(raw) as GameDetails[]

  return { games }
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
    <div className="p-8">
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-8">
        <h1 className="text-4xl">Games</h1>

        <div className=""></div>

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
            title="Over $1000"
            games={filteredGames}
            min={1_000}
            max={50_000}
          />
        </div>
      </div>
    </div>
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
  const filteredGames = games
    .filter((game) => game.grossRevenue >= min && game.grossRevenue < max)
    .sort((a, b) => (a.grossRevenue > b.grossRevenue ? -1 : 1))

  if (filteredGames.length === 0) {
    return null
  }

  return (
    <div className="w-full">
      <h2
        className="text-3xl mb-8"
        id={slugify(title, { lower: true })}
      >
        {title}
      </h2>
      <div className="flex flex-wrap gap-8">
        {filteredGames.map((game) => (
          <GameCard
            key={game.id}
            game={game}
          />
        ))}
      </div>
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
