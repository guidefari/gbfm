import { Effect } from 'effect'
import { getApiClient } from '@/api/client'

export const getFeaturedMix = Effect.gen(function* () {
  const client = yield* getApiClient
  const result = yield* client.audio.getAudioByType({
    params: { type: 'mix' },
    query: { limit: 1, offset: 0 }
  })
  return result.data[0] ?? null
})
