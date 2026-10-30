import { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import { GetMicroPostListResponse, LatestMicroPostResponse } from '@gbfm/api/post'
import { browseMonths, browsePage, browseWindow } from '@gbfm/core/tweet-browse'
import { Effect, Option, Schema } from 'effect'

import { optionalPageRequest } from '../../../server/page-data/requests'
import { json } from '../../../server/page-data/shared'
import { parseCheckpoint } from '../reader'
import type { TweetBrowseDocument } from './document'
import { isTweetBrowse } from './links'

export const loadTweetBrowseData = (request: Request, url: URL) => {
  if (!isTweetBrowse(url)) return null

  return Effect.runPromise(
    Effect.gen(function* () {
      const latestResponse = yield* optionalPageRequest(request, '/api/content/posts/micro/latest')

      const latest = latestResponse?.ok
        ? Option.getOrNull(
            Schema.decodeUnknownOption(LatestMicroPostResponse)(
              yield* Effect.promise(() => json(latestResponse)),
            ),
          )
        : null

      const navigationResponse = latest
        ? yield* optionalPageRequest(
            request,
            `/api/content/posts/micro/${encodeURIComponent(latest.slug)}/neighbours`,
          )
        : null

      const navigation = navigationResponse?.ok
        ? Option.getOrNull(
            Schema.decodeUnknownOption(MicroPostNeighboursResponse)(
              yield* Effect.promise(() => json(navigationResponse)),
            ),
          )
        : null

      const timeline = browseMonths(navigation?.timeline ?? [])

      const window = browseWindow(
        timeline,
        url.searchParams.get('month'),
        browsePage(url.searchParams.get('page')),
      )

      const response = yield* optionalPageRequest(
        request,
        `/api/content/posts/micro?limit=${timeline.length ? window.limit : 30}&offset=${window.offset}`,
      )

      const result = response?.ok
        ? Option.getOrNull(
            Schema.decodeUnknownOption(GetMicroPostListResponse)(
              yield* Effect.promise(() => json(response)),
            ),
          )
        : null

      return {
        ...window,
        timeline,
        posts:
          result?.data.filter(
            (post) => !window.month || post.createdAt.slice(0, 7) === window.month,
          ) ?? [],
        total: timeline.length ? window.total : (result?.pagination.total ?? 0),
        hasMore: timeline.length ? window.hasMore : (result?.pagination.hasMore ?? false),
        datesAvailable: navigation !== null,
        selected: parseCheckpoint(url.searchParams.get('selected')),
        failure: result ? null : 'Tweets are unavailable. Please try again.',
      } satisfies TweetBrowseDocument
    }),
  )
}
