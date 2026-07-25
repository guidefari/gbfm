import { makePlayReporterLayer } from '@gbfm/player'
import { Effect } from 'effect'
import { getApiClient } from '@/api/client'

export const trackAudioPlay = (trackId: string) =>
  Effect.gen(function* () {
    const client = yield* getApiClient
    yield* client.audio.trackAudioPlay({ params: { id: trackId } })
  })

export const PlayReporterLive = makePlayReporterLayer(trackAudioPlay)
