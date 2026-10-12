import { defineHandler } from 'nitro'
import { start } from 'workflow/api'

import { authoriseScrapeTrigger } from '../../../../app/scrape/trigger-auth'
import { scrapeGames } from '../../../../workflows/scrape-games'

export default defineHandler(async (event) => {
  const trigger = authoriseScrapeTrigger(event.req.method, event.req.headers)

  if (!trigger) {
    return new Response('Unauthorized.', { status: 401 })
  }

  const run = await start(scrapeGames, [{ trigger }])

  return { runId: run.runId }
})
