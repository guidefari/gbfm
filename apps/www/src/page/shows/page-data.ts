import { GetAllShowsResponse, GetShowEpisodesResponse } from '@gbfm/api/shows'
import { SiteMetadata } from '@gbfm/site-metadata'
import { Effect, Option, Schema } from 'effect'

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
  const detailSlug = Route.guards.Detail(route) && route.kind === 'shows' ? route.slug : null

  if (!endpoint || (!listing && !detailSlug)) return null

  const responsePromise = Effect.runPromise(optionalPageRequest(request, endpoint))

  const detailPromise = detailSlug
    ? Effect.runPromise(
        Effect.all(
          {
            list: optionalPageRequest(request, '/api/shows?limit=100&offset=0'),
            episodes: optionalPageRequest(
              request,
              `/api/shows/${encodeURIComponent(detailSlug)}/episodes?limit=100&offset=0`,
            ),
            metadata: optionalPageRequest(
              request,
              `/api/site-metadata/show/${encodeURIComponent(detailSlug)}`,
            ),
          },
          { concurrency: 'unbounded' },
        ),
      )
    : null

  return Promise.all([responsePromise, detailPromise]).then(async ([response, detail]) => {
    const payload = response?.ok ? await json(response) : null
    const allResponse = listing ? response : (detail?.list ?? null)

    const all = allResponse?.ok
      ? Schema.decodeUnknownSync(GetAllShowsResponse)(listing ? payload : await json(allResponse))
      : null

    let shows: ShowsDocument | null = null

    if (all) {
      const selectedSlug = detailSlug ?? url.searchParams.get('show') ?? all.data[0]?.slug ?? null

      const episodesResponse = selectedSlug
        ? detailSlug
          ? (detail?.episodes ?? null)
          : await apiRequest(
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
      detailSlug,
      metadata:
        response?.ok && detail?.metadata?.ok
          ? Option.getOrNull(Schema.decodeUnknownOption(SiteMetadata)(await detail.metadata.json()))
          : null,
    }
  })
}
