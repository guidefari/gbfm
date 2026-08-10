import { Context, Effect, Layer } from 'effect'
import { ReminderQueueUnavailable } from '@/errors'

export interface ReminderJob {
  readonly reminderId: string
  readonly idempotencyKey: string
  readonly dueAt: number
}

export interface ReminderQueue {
  readonly enqueue: (job: ReminderJob) => Effect.Effect<void, ReminderQueueUnavailable>
}

export const ReminderQueue = Context.Service<ReminderQueue>('ReminderQueue')

export interface ReminderQueueSender {
  send(message: ReminderJob): Promise<unknown>
}

export const ReminderQueueLayer = (queue: ReminderQueueSender) =>
  Layer.succeed(ReminderQueue, {
    enqueue: (job) =>
      Effect.tryPromise({
        try: () => queue.send(job),
        catch: () => new ReminderQueueUnavailable({ reminderId: job.reminderId })
      }).pipe(Effect.asVoid)
  })
