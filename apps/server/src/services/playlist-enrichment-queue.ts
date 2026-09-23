import { Context, Effect, Layer, Schema } from 'effect'
import { PlaylistEnrichmentQueueUnavailable } from '@/errors'

export const PlaylistEnrichmentJob = Schema.Struct({
  _tag: Schema.Literal('PlaylistEnrichmentJob'),
  playlistId: Schema.String,
  reason: Schema.Literals(['after_import', 'manual'])
})
export type PlaylistEnrichmentJob = typeof PlaylistEnrichmentJob.Type

export interface PlaylistEnrichmentQueue {
  readonly enqueue: (
    job: PlaylistEnrichmentJob
  ) => Effect.Effect<void, PlaylistEnrichmentQueueUnavailable>
}

export const PlaylistEnrichmentQueue =
  Context.Service<PlaylistEnrichmentQueue>('PlaylistEnrichmentQueue')

export interface PlaylistEnrichmentQueueSender {
  send(message: PlaylistEnrichmentJob): Promise<unknown>
}

export const PlaylistEnrichmentQueueLayer = (queue: PlaylistEnrichmentQueueSender) =>
  Layer.succeed(PlaylistEnrichmentQueue, {
    enqueue: (job) =>
      Effect.tryPromise({
        try: () => queue.send(job),
        catch: () => new PlaylistEnrichmentQueueUnavailable({ playlistId: job.playlistId })
      }).pipe(Effect.asVoid)
  })

export const PlaylistEnrichmentQueueTestLayer = Layer.succeed(PlaylistEnrichmentQueue, {
  enqueue: () => Effect.void
})
