import { timingSafeEqual } from 'node:crypto'

import { defineHandler } from 'nitro'
import { start } from 'workflow/api'

import { health } from '../../../../workflows/health'

function isAuthorised(provided: string | null): boolean {
  const expected = process.env.SCRAPE_KEY

  if (!expected || !provided) {
    return false
  }

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)

  return a.length === b.length && timingSafeEqual(a, b)
}

export default defineHandler(async (event) => {
  if (!isAuthorised(event.req.headers.get('x-scrape-key'))) {
    return new Response('Unauthorized.', { status: 401 })
  }

  const run = await start(health, [])

  return { runId: run.runId }
})
