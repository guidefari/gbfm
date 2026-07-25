import { makePlayReporterLayer } from '@gbfm/player'
import { Effect } from 'effect'
import { getApiClient } from '@/lib/api-client'

const trackAudioPlay = (trackId: string) =>
  Effect.gen(function* () {
    const client = yield* Effect.promise(() => getApiClient())
    yield* client.audio.trackAudioPlay({ params: { id: trackId } })
  })

export const PlayReporterLive = makePlayReporterLayer(trackAudioPlay)
