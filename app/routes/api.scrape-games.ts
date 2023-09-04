import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'

import fs from 'fs'
//@ts-ignore
import tqdm from 'tqdm'

import type { GameDetails } from '~/games'

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')

  if (!key || key !== 'YTViNDlkMGMtNTZiYi00Y2ExLWFhOGItZmE5NDNhM2E3ZWYyIA') {
    return new Response('Unauthorized.', { status: 401 })
  }

  const ignoredIds = await loadIgnoredIds()

  const gameIds = await fetchGameIds()

  const games = []

  let counter = 0


  for (const gameId of tqdm(gameIds)) {
    try {
      if (ignoredIds.includes(gameId)) {
        continue
      }

      const game = await fetchGameDetails(gameId)

      if (game) {
        games.push(game)
      } else {
        ignoredIds.push(gameId)
      }

      if (counter++ % 50 === 0) {
        await saveGames(games, ignoredIds)
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`Failed to scrape the game with the id: ${gameId}.`)
      console.error(error)
    }
  }

  await saveGames(games, ignoredIds)

  return json({ games })
}

async function fetchGameIds(): Promise<number[]> {
  const request = await fetch('http://api.steampowered.com/ISteamApps/GetAppList/v0002/?format=json')
  const data = await request.json()

  return data.applist.apps
    .filter((app: any) => Boolean(app.name) && app.name.trim() !== '')
    .map((app: any) => app.appid)
}

async function fetchGameDetails(gameId: number): Promise<GameDetails | undefined> {
  const request = await fetch(`https://store.steampowered.com/api/appdetails?appids=${gameId}&cc=us&l=en`)

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
      url: details.metacritic?.url,
    },
    screenshots: details.screenshots?.map((screenshot: any) => screenshot.path_full),
    numberOfReviews: details.recommendations?.total ?? 0,
    genres: details.genres?.map((genre: any) => genre.description) ?? [],
    categories: details.categories?.map((category: any) => category.description) ?? [],
  }

}

async function saveGames(games: GameDetails[], ignoredIds: number[]): Promise<void> {
  console.log(`Saving data(${games.length} Games, ${ignoredIds.length}) Ignored Games.`)

  await fs.promises.writeFile('./data/games.json', JSON.stringify(games, null, 2))
  await fs.promises.writeFile('./data/ignored.json', JSON.stringify(ignoredIds, null, 2))
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