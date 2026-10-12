import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { resetDatabaseConnection } from '~/db'
import {
  collectFailedIds,
  findRun,
  finishRun,
  recordChunk,
  startRun,
  summariseRetry,
  updateRun
} from '~/scrape/run-record'

beforeAll(() => {
  process.env.DB_URL = inject('mongoUri')
  process.env.DB_DATABASE = `test-${randomUUID()}`
})

afterAll(async () => {
  await resetDatabaseConnection()
})

describe('scrape run record (real MongoDB)', () => {
  it('starts a run once, so a retried start never resets it.', async () => {
    await startRun('run-1', 'cron', Date.UTC(2026, 9, 12))
    await finishRun('run-1', 'succeeded')
    await startRun('run-1', 'manual', Date.UTC(2026, 9, 13))

    const run = await findRun('run-1')

    expect(run).toMatchObject({
      trigger: 'cron',
      status: 'succeeded',
      startedAt: new Date(Date.UTC(2026, 9, 12))
    })
    expect(run?.finishedAt).toBeInstanceOf(Date)
  })

  it('overwrites a chunk result when the chunk is recorded again.', async () => {
    await startRun('run-2', 'cron', 1)
    await recordChunk('run-2', 'chunks', 0, { saved: 1, failedIds: [5] })
    await recordChunk('run-2', 'chunks', 0, { saved: 2, failedIds: [] })

    const run = await findRun('run-2')

    expect(run?.chunks).toEqual({ '0': { saved: 2, failedIds: [] } })
  })

  it('collects failed ids across chunks, sorted and without duplicates.', async () => {
    await startRun('run-3', 'cron', 1)
    await recordChunk('run-3', 'chunks', 0, { saved: 0, failedIds: [9, 3] })
    await recordChunk('run-3', 'chunks', 1, { saved: 0, failedIds: [3, 1] })

    expect(await collectFailedIds('run-3', 'chunks')).toEqual([1, 3, 9])
    expect(await collectFailedIds('run-3', 'retryChunks')).toEqual([])
  })

  it('summarises the retry pass from its chunk results.', async () => {
    await startRun('run-4', 'cron', 1)
    await recordChunk('run-4', 'retryChunks', 0, { saved: 3, failedIds: [8] })
    await recordChunk('run-4', 'retryChunks', 1, { saved: 1, failedIds: [] })

    const retry = await summariseRetry('run-4', 5)

    expect(retry).toEqual({ attempted: 5, saved: 4, stillFailed: [8] })
    expect((await findRun('run-4'))?.retry).toEqual(retry)
  })

  it('records updates and a failure message.', async () => {
    await startRun('run-5', 'manual', 1)
    await updateRun('run-5', { listed: 42, delisted: { count: 2 } })
    await finishRun('run-5', 'failed', 'Steam is down.')

    expect(await findRun('run-5')).toMatchObject({
      listed: 42,
      delisted: { count: 2 },
      status: 'failed',
      error: 'Steam is down.'
    })
  })
})
