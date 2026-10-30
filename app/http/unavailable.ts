const REQUEST_DEADLINE_MS = 8_000
const RETRY_AFTER_SECONDS = '30'

const maxTimeExpired = 50

// React Router sanitizes errors before the entry renders, so only handleError
// sees what really failed, and it remembers that here for server/ssr.ts.
const unavailableRequests = new WeakSet<Request>()

const databaseOutages = new Set([
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoPoolClearedError',
  'MongoServerSelectionError',
  'MongoTopologyClosedError',
  'MongoWaitQueueTimeoutError'
])

function isDatabaseOutage(error: unknown): boolean {
  const { code, name } = (error ?? {}) as { code?: unknown; name?: unknown }

  return (
    code === maxTimeExpired ||
    (typeof name === 'string' && databaseOutages.has(name))
  )
}

export function markIfUnavailable(error: unknown, request: Request): void {
  if (isDatabaseOutage(error)) {
    unavailableRequests.add(request)
  }
}

function unavailableHeaders(headers?: Headers): Headers {
  const result = new Headers(headers)

  // A CDN must not keep an outage, and well-behaved crawlers back off.
  result.set('Cache-Control', 'no-store')
  result.set('Retry-After', RETRY_AFTER_SECONDS)

  return result
}

export function markedUnavailable(request: Request, response: Response): Response {
  if (!unavailableRequests.has(request)) {
    return response
  }

  return new Response(response.body, {
    status: 503,
    headers: unavailableHeaders(response.headers)
  })
}

export async function withDeadline(
  handle: () => Promise<Response>,
  deadlineMs = REQUEST_DEADLINE_MS
): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const deadline = new Promise<Response>((resolve) => {
    timer = setTimeout(() => {
      resolve(
        new Response('Service temporarily unavailable.', {
          status: 503,
          headers: unavailableHeaders(
            new Headers({ 'Content-Type': 'text/plain' })
          )
        })
      )
    }, deadlineMs)
  })

  try {
    return await Promise.race([handle(), deadline])
  } finally {
    clearTimeout(timer)
  }
}
