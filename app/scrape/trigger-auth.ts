import { timingSafeEqual } from 'node:crypto'

import type { ScrapeTrigger } from '~/scrape/run-record'

export function secretMatches(
  provided: string | null | undefined,
  expected: string | undefined
): boolean {
  if (!provided || !expected) {
    return false
  }

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)

  return a.length === b.length && timingSafeEqual(a, b)
}

export function authoriseScrapeTrigger(
  method: string,
  headers: Headers,
  env: Record<string, string | undefined> = process.env
): ScrapeTrigger | null {
  if (method === 'GET') {
    // Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
    const authorization = headers.get('authorization') ?? ''
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : null

    return secretMatches(token, env.CRON_SECRET) ? 'cron' : null
  }

  if (method === 'POST') {
    return secretMatches(headers.get('x-scrape-key'), env.SCRAPE_KEY)
      ? 'manual'
      : null
  }

  return null
}
