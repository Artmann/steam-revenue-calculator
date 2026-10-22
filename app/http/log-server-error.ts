import { isRouteErrorResponse } from 'react-router'

// Mirrors React Router's default handleError, minus 404s: bots probing
// missing paths would otherwise fill the error logs.
export function logServerError(error: unknown, request: Request): void {
  if (request.signal.aborted) {
    return
  }

  if (isRouteErrorResponse(error) && error.status === 404) {
    return
  }

  const routeError = isRouteErrorResponse(error)
    ? (error as { error?: unknown }).error
    : undefined

  console.error(routeError ?? error)
}
