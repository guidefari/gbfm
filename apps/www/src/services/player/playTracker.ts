import { createPlayDelivery, PlayerStorage, PlayReporter } from '@gbfm/player'
import { Effect, Layer, Semaphore } from 'effect'
import { getApiClient } from '@/lib/api-client'

const trackAudioPlay = (trackId: string) =>
  Effect.gen(function* () {
    const client = yield* Effect.promise(() => getApiClient())
    yield* client.audio.trackAudioPlay({ params: { id: trackId } })
  })

export const PlayReporterLive = Layer.effect(
  PlayReporter,
  Effect.gen(function* () {
    const storage = yield* PlayerStorage

    const deliverPlayIfFresh = createPlayDelivery({
      isWithinDedupWindow: storage.isWithinDedupWindow,
      deliver: trackAudioPlay,
      remember: storage.recordPlay,
      now: Date.now
    })

    // Plays are serialised so a burst of skips cannot interleave dedup reads
    // with the write that closes the window.
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
