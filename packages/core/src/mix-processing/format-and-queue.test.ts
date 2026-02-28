import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { makeInMemoryJobQueue } from './job-queue'
import { formatTracklist } from './processing'

describe('formatTracklist', () => {
  test('formats valid tab separated lines and ignores comments and blanks', () => {
    const input = `
# comment
01\tArtist One\tTrack A

02\tArtist Two\tTrack\tWith\tTabs
    `.trim()

    const result = formatTracklist(input)

    expect(result).toBe(
      '01. Artist One - Track A\n02. Artist Two - Track With Tabs'
    )
  })
})

describe('makeInMemoryJobQueue', () => {
  test('submits jobs, updates status, and queries current state', async () => {
    const queue = await Effect.runPromise(makeInMemoryJobQueue)

    await Effect.runPromise(queue.submit('job-1'))
    const queued = await Effect.runPromise(queue.getStatus('job-1'))
    expect(queued).toBeDefined()
    expect(queued?.status).toEqual({ _tag: 'Queued' })
    expect(typeof queued?.createdAt).toBe('number')
    expect(typeof queued?.updatedAt).toBe('number')

    await Effect.runPromise(queue.updateStatus('job-1', { _tag: 'Processing' }))
    const updated = await Effect.runPromise(queue.getStatus('job-1'))
    expect(updated?.status).toEqual({ _tag: 'Processing' })
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(updated?.createdAt ?? 0)
  })

  test('returns undefined for missing jobs and ignores status updates for unknown ids', async () => {
    const queue = await Effect.runPromise(makeInMemoryJobQueue)

    expect(await Effect.runPromise(queue.getStatus('missing'))).toBeUndefined()
    await Effect.runPromise(
      queue.updateStatus('missing', { _tag: 'Failed', error: 'no-op' })
    )
    expect(await Effect.runPromise(queue.getStatus('missing'))).toBeUndefined()
  })

  test('returns all submitted jobs', async () => {
    const queue = await Effect.runPromise(makeInMemoryJobQueue)

    await Effect.runPromise(queue.submit('job-a'))
    await Effect.runPromise(queue.submit('job-b'))

    const jobs = await Effect.runPromise(queue.getAllJobs())
    const ids = jobs.map((job) => job.id).sort()
    expect(ids).toEqual(['job-a', 'job-b'])
  })
})
