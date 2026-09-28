import { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import { MicroPostScreenResponse } from '@gbfm/api/post'
import { Effect, Option, Schema } from 'effect'

import { optionalPageRequest } from './requests'
import { json } from './shared'

export const loadTweetData = (request: Request, endpoint: string | null, slug: string | null) =>
  slug && endpoint
    ? Effect.runPromise(
        Effect.all(
          {
            screen: optionalPageRequest(request, endpoint),
            neighbours: optionalPageRequest(
              request,
              `/api/content/posts/micro/${encodeURIComponent(slug)}/neighbours`,
            ),
            metadata: optionalPageRequest(
              request,
              `/api/site-metadata/tweet/${encodeURIComponent(slug)}`,
            ),
          },
          { concurrency: 'unbounded' },
        ),
      ).then(async (data) => {
        const payload = data.screen?.ok ? await json(data.screen) : null

        return {
          screen: data.screen,
          metadata: data.metadata,
          neighbourResponse: data.neighbours,
          payload,
          tweet: payload ? Schema.decodeUnknownSync(MicroPostScreenResponse)(payload) : null,
          neighbours: data.neighbours?.ok
            ? Option.getOrNull(
                Schema.decodeUnknownOption(MicroPostNeighboursResponse)(
                  await json(data.neighbours),
                ),
              )
            : null,
        }
      })
    : null
