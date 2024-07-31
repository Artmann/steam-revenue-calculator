import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'

import fs from 'fs'
//@ts-ignore
import tqdm from 'tqdm'

import { createGameSlug, type GameDetails } from '~/games'
import { Game } from '~/models/game'
import { calculateRevenue } from '~/revenue'

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  const cursor = parseInt(url.searchParams.get('cursor') ?? '1', 10)

  if (!key || key !== 'YTViNDlkMGMtNTZiYi00Y2ExLWFhOGItZmE5NDNhM2E3ZWYyIA') {
    return new Response('Unauthorized.', { status: 401 })
  }

  const ignoredIds = await loadIgnoredIds()

  const gameIds = await fetchGameIds()

  const batchSize = 1
  const maxCursor = Math.ceil(gameIds.length / batchSize)
  const nextCursor = cursor + 1 > maxCursor ? 0 : cursor + 1

  const gameIdsToScrape = gameIds.slice(
    cursor * batchSize,
    (cursor + 1) * batchSize
  )

  for (const gameId of tqdm(gameIdsToScrape)) {
    try {
      if (ignoredIds.includes(gameId)) {
        continue
      }

      const gameDetails = await fetchGameDetails(gameId)

      if (!gameDetails) {
        console.log(`Game with the id: ${gameId} is not found.`)

        continue
      }

      const slug = createGameSlug(gameDetails.name)

      const existingGame = await Game.findBy('gameId', gameId)

      const grossRevenue = calculateRevenue(
        gameDetails.numberOfReviews,
        gameDetails.price / 100
      )

      if (existingGame) {
        existingGame.details = gameDetails
        existingGame.grossRevenue = grossRevenue
        existingGame.slug = slug

        await existingGame.save()
      } else {
        await Game.create({
          details: gameDetails,
          gameId,
          grossRevenue,
          slug
        })
      }

      await new Promise((resolve) => setTimeout(resolve, 2_000))
    } catch (error) {
      console.error(`Failed to scrape the game with the id: ${gameId}.`)
      console.error(error)
    }
  }


  return json({
    batchSize,
    cursor,
    maxCursor,
    nextCursor,
    gameIdsToScrape
  })
}

async function fetchGameIds(): Promise<number[]> {
  const request = await fetch(
    'http://api.steampowered.com/ISteamApps/GetAppList/v0002/?format=json'
  )
  const data = await request.json()

  return data.applist.apps
    .filter((app: any) => Boolean(app.name) && app.name.trim() !== '')
    .map((app: any) => app.appid)
}

async function fetchGameDetails(
  gameId: number
): Promise<GameDetails | undefined> {
  const request = await fetch(
    `https://store.steampowered.com/api/appdetails?appids=${gameId}&cc=us&l=en`
  )

  if (request.status == 429) {
    console.log('Rate limited. Waiting 30 seconds...')

    await new Promise((resolve) => setTimeout(resolve, 30000))

    return fetchGameDetails(gameId)
  }

  const data = await request.json()

  const details = data[gameId].data

  if (!details) {
    return
  }

  if (details.is_free) {
    return
  }

  return {
    id: gameId,
    name: details.name,
    description: details.short_description,
    developers: details.developers,
    publishers: details.publishers,
    price: details.price_overview?.final,
    metacritic: {
      score: details.metacritic?.score,
      url: details.metacritic?.url
    },
    screenshots: details.screenshots?.map(
      (screenshot: any) => screenshot.path_full
    ),
    numberOfReviews: details.recommendations?.total ?? 0,
    genres: details.genres?.map((genre: any) => genre.description) ?? [],
    categories:
      details.categories?.map((category: any) => category.description) ?? []
  }
}

async function loadIgnoredIds(): Promise<number[]> {
  try {
    const data = await fs.promises.readFile('./data/ignored.json', 'utf-8')

    return JSON.parse(data) ?? []
  } catch (error) {
    console.error(error)
  }

  return []
}

