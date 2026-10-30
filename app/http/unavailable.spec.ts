import { describe, expect, it } from 'vitest'

import {
  markedUnavailable,
  markIfUnavailable,
  withDeadline
} from '~/http/unavailable'

function failure(name: string, code?: number): Error {
  return Object.assign(new Error('failed'), { name, code })
}

function errorPage(): Response {
  return new Response('<h1>Something went wrong.</h1>', {
    status: 500,
    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=300' }
  })
}

describe('markedUnavailable', () => {
  it.each([
    ['MongoServerSelectionError'],
    ['MongoNetworkError'],
    ['MongoNetworkTimeoutError'],
    ['MongoWaitQueueTimeoutError']
  ])('turns a %s into an uncached 503.', async (name) => {
    const request = new Request('https://example.com/app/1')

    markIfUnavailable(failure(name), request)

    const response = markedUnavailable(request, errorPage())

    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Retry-After')).toBe('30')
    expect(response.headers.get('Content-Type')).toBe('text/html')
    expect(await response.text()).toBe('<h1>Something went wrong.</h1>')
  })

  it('treats a query that ran out of time as unavailable.', () => {
    const request = new Request('https://example.com/tags/action?since=2016')

    markIfUnavailable(failure('MongoServerError', 50), request)

    expect(markedUnavailable(request, errorPage()).status).toBe(503)
  })

  it('leaves other errors alone.', () => {
    const request = new Request('https://example.com/app/1')
    const response = errorPage()

    markIfUnavailable(new TypeError('a bug'), request)

    expect(markedUnavailable(request, response)).toBe(response)
  })
})

describe('withDeadline', () => {
  it('returns the response when it is in time.', async () => {
    const response = new Response('ok')

    expect(await withDeadline(async () => response)).toBe(response)
  })

  it('answers with an uncached 503 at the deadline.', async () => {
    const response = await withDeadline(() => new Promise(() => {}), 1)

    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Retry-After')).toBe('30')
  })
})
