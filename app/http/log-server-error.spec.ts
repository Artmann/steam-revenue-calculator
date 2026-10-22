import { afterEach, describe, expect, it, vi } from 'vitest'

import { logServerError } from './log-server-error'

function createRouteErrorResponse(status: number, error?: Error) {
  return {
    data: null,
    error,
    internal: true,
    status,
    statusText: ''
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('logServerError', () => {
  it('logs unexpected errors.', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Boom')

    logServerError(error, new Request('https://example.com/'))

    expect(consoleError).toHaveBeenCalledWith(error)
  })

  it('logs the underlying error of a route error response.', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Method not allowed')

    logServerError(
      createRouteErrorResponse(405, error),
      new Request('https://example.com/')
    )

    expect(consoleError).toHaveBeenCalledWith(error)
  })

  it('does not log 404s.', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    logServerError(
      createRouteErrorResponse(
        404,
        new Error('No route matches URL "/pages-sitemap.xml"')
      ),
      new Request('https://example.com/pages-sitemap.xml')
    )

    expect(consoleError).not.toHaveBeenCalled()
  })

  it('does not log errors from aborted requests.', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const controller = new AbortController()

    controller.abort()

    logServerError(
      new Error('Boom'),
      new Request('https://example.com/', { signal: controller.signal })
    )

    expect(consoleError).not.toHaveBeenCalled()
  })
})
