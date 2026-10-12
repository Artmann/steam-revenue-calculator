import { describe, expect, it } from 'vitest'

import { authoriseScrapeTrigger, secretMatches } from '~/scrape/trigger-auth'

const env = { CRON_SECRET: 'cron-secret', SCRAPE_KEY: 'scrape-key' }

function headers(values: Record<string, string>): Headers {
  return new Headers(values)
}

describe('authoriseScrapeTrigger', () => {
  it('accepts the cron secret as a bearer token on GET.', () => {
    expect(
      authoriseScrapeTrigger('GET', headers({ authorization: 'Bearer cron-secret' }), env)
    ).toBe('cron')
  })

  it('accepts the scrape key header on POST.', () => {
    expect(
      authoriseScrapeTrigger('POST', headers({ 'x-scrape-key': 'scrape-key' }), env)
    ).toBe('manual')
  })

  it('rejects wrong secrets and secrets sent to the other method.', () => {
    expect(
      authoriseScrapeTrigger('GET', headers({ authorization: 'Bearer nope' }), env)
    ).toBeNull()
    expect(
      authoriseScrapeTrigger('GET', headers({ 'x-scrape-key': 'scrape-key' }), env)
    ).toBeNull()
    expect(
      authoriseScrapeTrigger('POST', headers({ authorization: 'Bearer cron-secret' }), env)
    ).toBeNull()
  })

  it('rejects everything when the secrets are not configured.', () => {
    expect(
      authoriseScrapeTrigger('GET', headers({ authorization: 'Bearer ' }), {})
    ).toBeNull()
    expect(
      authoriseScrapeTrigger('POST', headers({ 'x-scrape-key': '' }), {})
    ).toBeNull()
  })

  it('rejects other methods.', () => {
    expect(
      authoriseScrapeTrigger('PUT', headers({ 'x-scrape-key': 'scrape-key' }), env)
    ).toBeNull()
  })
})

describe('secretMatches', () => {
  it('compares secrets of different lengths without throwing.', () => {
    expect(secretMatches('short', 'much-longer-secret')).toBe(false)
    expect(secretMatches('same', 'same')).toBe(true)
  })
})
