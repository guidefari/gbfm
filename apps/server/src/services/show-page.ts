import type { AudioPagePrincipal } from '@gbfm/api/audio'
import { ShowPageResponse } from '@gbfm/api/shows'
import { Cause, Effect } from 'effect'

import type { DatabaseError, NotFoundError } from '@/errors'

import { ConfigService } from './config.service'
import { ShowService, ShowSubscriptionService } from './show.service'
import { presentationFromShow } from './site-presentation.service'

export const loadShowPage = Effect.fn('show.page')(function* (
  slug: string,
  principal: AudioPagePrincipal | null,
): Effect.fn.Return<
  ShowPageResponse,
  never,
  ShowService | ShowSubscriptionService | ConfigService
> {
  const service = yield* ShowService
  const subscriptions = yield* ShowSubscriptionService
  const config = yield* ConfigService
  const actor = principal ? { userId: principal.id, userRole: principal.role } : undefined

  return yield* Effect.gen(function* (): Effect.fn.Return<
    ShowPageResponse,
    DatabaseError | NotFoundError
  > {
    const show = yield* service.getBySlug(slug)

    const results = yield* Effect.all(
      {
        shows: service.getNavigationShows.pipe(
          Effect.map((shows) =>
            shows.map((item) => ({
              ...item,
              createdAt: item.createdAt.toISOString(),
              updatedAt: item.updatedAt.toISOString(),
            })),
          ),
          Effect.catch(() => Effect.succeed([])),
        ),
        episodes: service.getEpisodesForShow(show, { limit: 100, offset: 0 }, actor).pipe(
          Effect.map((result) => ({
            data: result.data.map((episode) => ({
              ...episode,
              createdAt: episode.createdAt.toISOString(),
              updatedAt: episode.updatedAt.toISOString(),
            })),
            pagination: result.pagination,
          })),
          Effect.catch(() => Effect.succeed(null)),
        ),
        metadata: Effect.suspend(() => presentationFromShow(show, config.urls.frontend)).pipe(
          Effect.map((presentation) => presentation.metadata),
          Effect.catchCause((cause) =>
            Cause.hasInterrupts(cause)
              ? Effect.failCause(cause)
              : Effect.logWarning({
                  operation: 'show.page.metadata',
                  errorTag: 'MetadataUnavailable',
                }).pipe(Effect.as(null)),
          ),
        ),
        subscription: principal
          ? subscriptions.isSubscribed(principal.id, show.id).pipe(
              Effect.map((active) => (active ? ('active' as const) : ('inactive' as const))),
              Effect.catch(() => Effect.succeed('unavailable' as const)),
            )
          : Effect.succeed('anonymous' as const),
      },
      { concurrency: 'unbounded' },
    )

    return ShowPageResponse.cases.Ready.make({
      principal,
      show: {
        ...show,
        createdAt: show.createdAt.toISOString(),
        updatedAt: show.updatedAt.toISOString(),
      },
      ...results,
    })
  }).pipe(
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed(ShowPageResponse.cases.NotFound.make({ principal })),
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.logError({ operation: 'show.page', errorTag: 'DatabaseError' }).pipe(
        Effect.as(ShowPageResponse.cases.Unavailable.make({ principal })),
      ),
    ),
  )
})
