import { Effect } from 'effect'
import { getApiClient } from '@/api/client'
import {
  clearPosition as clearStoredPosition,
  isWithinDedupWindow,
  recordPlay,
  savePosition
} from '@/audio/queueStorage'

export const trackAudioPlay = (trackId: string) =>
  Effect.gen(function* () {
    const client = yield* getApiClient
    yield* client.audio.trackAudioPlay({ params: { id: trackId } })
  })

export const recordPlayIfFresh = (trackId: string) =>
  Effect.gen(function* () {
    const within = yield* isWithinDedupWindow(trackId)
    if (within) return
    yield* recordPlay(trackId)
    yield* trackAudioPlay(trackId).pipe(Effect.catch(() => Effect.void))
  })

export const recordPosition = (trackId: string, position: number) => savePosition(trackId, position)

export const clearPosition = (trackId: string) => clearStoredPosition(trackId)
