import { GetAllShowsResponse, GetShowEpisodesResponse } from '@gbfm/api/shows'
import { Effect, Schema } from 'effect'

import { Route } from '../../route'
import { apiRequest } from '../../server/api'
import { optionalPageRequest } from '../../server/page-data/requests'
import { json } from '../../server/page-data/shared'
import type { ShowsDocument } from './document'

export const loadShowsData = (
  request: Request,
  endpoint: string | null,
  route: Route,
  url: URL,
) => {
  const listing = Route.guards.Listing(route) && route.kind === 'shows'

  if (!endpoint || !listing) return null

  return Effect.runPromise(optionalPageRequest(request, endpoint)).then(async (response) => {
    const payload = response?.ok ? await json(response) : null
    const all = response?.ok ? Schema.decodeUnknownSync(GetAllShowsResponse)(payload) : null

    let shows: ShowsDocument | null = null

    if (all) {
      const selectedSlug = url.searchParams.get('show') ?? all.data[0]?.slug ?? null

      const episodesResponse = selectedSlug
        ? await apiRequest(
            request,
            `/api/shows/${encodeURIComponent(selectedSlug)}/episodes?limit=100&offset=0`,
            { method: 'GET' },
          ).catch(() => null)
        : null

      shows = {
        shows: all.data,
        selectedSlug,
        episodes: episodesResponse?.ok
          ? Schema.decodeUnknownSync(GetShowEpisodesResponse)(await json(episodesResponse))
          : null,
      }
    }

    return {
      response,
      payload,
      shows,
      detailSlug: null,
      metadata: null,
    }
  })
}
