import { describe, expect, it } from 'vitest'

import { ignoredAppIds } from './ignored-app-ids'

describe('ignoredAppIds', () => {
  it('loads the ignore list from data/ignored.json.', () => {
    expect(ignoredAppIds.size).toBeGreaterThan(1000)
    expect(ignoredAppIds.has(216938)).toBe(true)
  })
})
