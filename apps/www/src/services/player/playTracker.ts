import { createPlayDelivery } from '@gbfm/player'
import { Effect } from 'effect'
import { getApiClient } from '@/lib/api-client'
import { isWithinDedupWindow, recordPlay } from './storage'

const trackAudioPlay = (trackId: string) =>
  Effect.gen(function* () {
    const client = yield* Effect.promise(() => getApiClient())
    yield* client.audio.trackAudioPlay({ params: { id: trackId } })
  })

const deliverPlayIfFresh = createPlayDelivery({
  isWithinDedupWindow,
  deliver: trackAudioPlay,
  remember: recordPlay,
  now: Date.now
})

let playDeliveryTail: Promise<void> = Promise.resolve()

export const recordPlayIfFresh = (trackId: string) => {
  const delivery = playDeliveryTail
    .catch(() => undefined)
    .then(() => Effect.runPromise(deliverPlayIfFresh(trackId)))
  playDeliveryTail = delivery.catch(() => undefined)
  return delivery
}
