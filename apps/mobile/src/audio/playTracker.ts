import { Effect } from 'effect'
import { getApiClient } from '@/api/client'
import { createPlayDelivery } from '@gbfm/player'
import { playerStorage } from '@/runtime'

export const trackAudioPlay = (trackId: string) =>
  Effect.gen(function* () {
    const client = yield* getApiClient
    yield* client.audio.trackAudioPlay({ params: { id: trackId } })
  })

const deliverPlayIfFresh = createPlayDelivery({
  isWithinDedupWindow: playerStorage.isWithinDedupWindow,
  deliver: trackAudioPlay,
  remember: playerStorage.recordPlay,
  now: Date.now
})

let playDeliveryTail: Promise<void> = Promise.resolve()

export const recordPlayIfFresh = (trackId: string) =>
  Effect.tryPromise({
    try: () => {
      const delivery = playDeliveryTail
        .catch(() => undefined)
        .then(() => Effect.runPromise(deliverPlayIfFresh(trackId)))
      playDeliveryTail = delivery.catch(() => undefined)
      return delivery
    },
    catch: (error) => error
  })
