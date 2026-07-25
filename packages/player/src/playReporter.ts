import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export interface PlayReporterShape {
  /** Report that a track started playing. Implementations dedup and deliver to
   *  the API; failures must not interrupt playback. */
  readonly recordPlay: (trackId: string) => Effect.Effect<void>
}

export class PlayReporter extends Context.Service<PlayReporter, PlayReporterShape>()(
  '@gbfm/player/PlayReporter'
) {}

export const PlayReporterNoop = Layer.succeed(PlayReporter, {
  recordPlay: () => Effect.void
})
