import { describe, expect, it } from 'vitest'

import {
  applyNotFoundCaching,
  NOT_FOUND_CACHE_CONTROL
} from './not-found-caching'

describe('applyNotFoundCaching', () => {
  it('caches 404 responses at the CDN.', () => {
    const headers = new Headers()

    applyNotFoundCaching(404, headers)

    expect(headers.get('Cache-Control')).toEqual(NOT_FOUND_CACHE_CONTROL)
  })

  it('keeps a Cache-Control header the route already set.', () => {
    const headers = new Headers({ 'Cache-Control': 'no-store' })

    applyNotFoundCaching(404, headers)

    expect(headers.get('Cache-Control')).toEqual('no-store')
  })

  it('leaves other statuses alone.', () => {
    const headers = new Headers()

    applyNotFoundCaching(500, headers)

    expect(headers.has('Cache-Control')).toEqual(false)
  })
})
