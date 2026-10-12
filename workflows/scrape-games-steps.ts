import {
  finishRun,
  startRun,
  type ScrapeTrigger
} from '~/scrape/run-record'

export async function startRunStep(
  runId: string,
  trigger: ScrapeTrigger,
  startedAt: number
): Promise<void> {
  'use step'

  await startRun(runId, trigger, startedAt)
}

export async function finishRunStep(
  runId: string,
  status: 'succeeded' | 'failed',
  error?: string
): Promise<void> {
  'use step'

  await finishRun(runId, status, error)
}
