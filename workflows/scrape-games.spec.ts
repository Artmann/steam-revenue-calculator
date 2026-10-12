import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { start } from 'workflow/api'

import { resetDatabaseConnection } from '~/db'
import { findRun } from '~/scrape/run-record'

import { scrapeGames } from './scrape-games'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

describe('scrapeGames workflow', () => {
  it('records a run that starts and succeeds.', async () => {
    const run = await start(scrapeGames, [{ trigger: 'manual' }])

    expect(await run.returnValue).toEqual({ skipped: false, runId: run.runId })

    const record = await findRun(run.runId)

    expect(record).toMatchObject({ trigger: 'manual', status: 'succeeded' })
    expect(record?.finishedAt).toBeInstanceOf(Date)
  })
})
