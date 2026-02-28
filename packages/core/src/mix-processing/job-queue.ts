import { Context, Effect, HashMap, Ref, Schedule } from 'effect'
import type { JobInfo, JobStatus } from './types'

const JOB_TTL_MS = 60 * 60 * 1000 // 1 hour

export interface MixJobQueue {
  readonly submit: (jobId: string) => Effect.Effect<void>
  readonly updateStatus: (
    jobId: string,
    status: JobStatus
  ) => Effect.Effect<void>
  readonly getStatus: (jobId: string) => Effect.Effect<JobInfo | undefined>
  readonly getAllJobs: () => Effect.Effect<JobInfo[]>
}

export const MixJobQueue = Context.GenericTag<MixJobQueue>('MixJobQueue')

export const makeInMemoryJobQueue = Effect.gen(function* () {
  const store = yield* Ref.make(HashMap.empty<string, JobInfo>())

  const evictExpiredJobs = Ref.update(store, (map) => {
    const now = Date.now()
    return HashMap.filter(map, (job) => {
      const isTerminal =
        job.status._tag === 'Completed' || job.status._tag === 'Failed'
      return !(isTerminal && now - job.updatedAt > JOB_TTL_MS)
    })
  })

  yield* Ref.update(store, (map) =>
    HashMap.map(map, (job) =>
      job.status._tag === 'Processing'
        ? {
            ...job,
            status: {
              _tag: 'Failed' as const,
              error: 'Server restarted during processing'
            },
            updatedAt: Date.now()
          }
        : job
    )
  )

  yield* Effect.forkDaemon(
    evictExpiredJobs.pipe(Effect.repeat(Schedule.fixed('10 minutes')))
  )

  return MixJobQueue.of({
    submit: (jobId: string) =>
      Ref.update(store, (map) =>
        HashMap.set(map, jobId, {
          id: jobId,
          status: { _tag: 'Queued' as const },
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      ),

    updateStatus: (jobId: string, status: JobStatus) =>
      Ref.update(store, (map) => {
        const existing = HashMap.get(map, jobId)
        if (existing._tag === 'None') return map
        return HashMap.set(map, jobId, {
          ...existing.value,
          status,
          updatedAt: Date.now()
        })
      }),

    getStatus: (jobId: string) =>
      Ref.get(store).pipe(
        Effect.map((map) => {
          const result = HashMap.get(map, jobId)
          return result._tag === 'Some' ? result.value : undefined
        })
      ),

    getAllJobs: () =>
      Ref.get(store).pipe(Effect.map((map) => Array.from(HashMap.values(map))))
  })
})
