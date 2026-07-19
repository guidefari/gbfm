import type { GetAllShowsResponse, GetShowEpisodesResponse } from '@gbfm/api/shows'
import { Effect } from 'effect'
import { getApiClient } from '@/api/client'

export type Show = (typeof GetAllShowsResponse.Type)['data'][number]
export type ShowEpisode = (typeof GetShowEpisodesResponse.Type)['data'][number]

export const getShows = Effect.gen(function* () {
  const client = yield* getApiClient
  const result = yield* client.shows.getAllShows({ query: { limit: 10, offset: 0 } })
  return result.data
})

export const getShowEpisodes = (slug: string) =>
  Effect.gen(function* () {
    const client = yield* getApiClient
    const result = yield* client.shows.getShowEpisodes({
      params: { slug },
      query: { limit: 50, offset: 0 }
    })
    return result.data
  })
