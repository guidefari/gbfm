import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Semaphore from 'effect/Semaphore'
import { createPlayDelivery } from './playDelivery'
import { PlayerStorage } from './playerStorage'

export interface PlayReporterContract {
  /** Report that a track started playing. Implementations dedup and deliver to
   *  the API; failures must not interrupt playback. */
  readonly recordPlay: (trackId: string) => Effect.Effect<void>
}

export class PlayReporter extends Context.Service<PlayReporter, PlayReporterContract>()(
  '@gbfm/player/PlayReporter'
) {}

export const PlayReporterNoop = Layer.succeed(PlayReporter, {
  recordPlay: () => Effect.void
})

/** Shared deduped delivery + semaphore serialization. Platforms only supply the
 *  API deliver operation; storage and ordering policy stay in @gbfm/player. */
export const makePlayReporterLayer = <DeliveryError>(
  deliver: (trackId: string) => Effect.Effect<void, DeliveryError>
): Layer.Layer<PlayReporter, never, PlayerStorage> =>
  Layer.effect(
    PlayReporter,
    Effect.gen(function* () {
      const storage = yield* PlayerStorage

      const deliverPlayIfFresh = createPlayDelivery({
        isWithinDedupWindow: storage.isWithinDedupWindow,
        deliver,
        remember: storage.recordPlay,
        now: Date.now
      })

      const lock = yield* Semaphore.make(1)

      return {
        recordPlay: (trackId: string) =>
          deliverPlayIfFresh(trackId).pipe(
            Semaphore.withPermits(lock, 1),
            Effect.catchCause(() => Effect.void)
          )
      }
    })
  )
