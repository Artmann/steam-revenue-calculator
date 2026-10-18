// Bots keep requesting missing games and junk paths. Letting the CDN keep
// those 404s for a while saves a function call and a database lookup each.
export const NOT_FOUND_CACHE_CONTROL =
  'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'

export function applyNotFoundCaching(status: number, headers: Headers): void {
  if (status !== 404 || headers.has('Cache-Control')) {
    return
  }

  headers.set('Cache-Control', NOT_FOUND_CACHE_CONTROL)
}
