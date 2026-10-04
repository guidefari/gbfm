import { AudioPageResponse, type AudioPagePrincipal } from '@gbfm/api/audio'
import { Cause, Effect } from 'effect'

import { AudioService } from './audio.service'
import { ConfigService } from './config.service'
import { FavoriteService } from './favorite.service'
import { presentationFromAudio } from './site-presentation.service'

export const loadAudioPage = Effect.fn('audio.page')(function* (
  type: 'mix' | 'track' | 'misc',
  slug: string,
  principal: AudioPagePrincipal | null,
): Effect.fn.Return<AudioPageResponse, never, AudioService | ConfigService | FavoriteService> {
  const service = yield* AudioService
  const config = yield* ConfigService
  const favorites = yield* FavoriteService
  const actor = principal ? { userId: principal.id, userRole: principal.role } : undefined

  return yield* Effect.gen(function* () {
    const audio = yield* service.getBySlug(type, slug, actor)

    const results = yield* Effect.all(
      {
        metadata:
          !audio.draft && (type === 'mix' || type === 'track')
            ? Effect.suspend(() => presentationFromAudio(type, audio, config.urls.frontend)).pipe(
                Effect.map((presentation) => presentation.metadata),
                Effect.catchCause((cause) =>
                  Cause.hasInterrupts(cause)
                    ? Effect.failCause(cause)
                    : Effect.logWarning({
                        operation: 'audio.page.metadata',
                        errorTag: 'MetadataUnavailable',
                      }).pipe(Effect.as(null)),
                ),
              )
            : Effect.succeed(null),
        favorite: principal
          ? favorites.hasAudioFavorite(principal.id, audio.id).pipe(
              Effect.map((active) => (active ? ('active' as const) : ('inactive' as const))),
              Effect.catch(() => Effect.succeed('unavailable' as const)),
            )
          : Effect.succeed('anonymous' as const),
      },
      { concurrency: 'unbounded' },
    )

    return AudioPageResponse.cases.Ready.make({
      principal,
      audio: {
        ...audio,
        createdAt: audio.createdAt.toISOString(),
        updatedAt: audio.updatedAt.toISOString(),
      },
      ...results,
    })
  }).pipe(
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed(AudioPageResponse.cases.NotFound.make({ principal })),
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.logError({ operation: 'audio.page', errorTag: 'DatabaseError' }).pipe(
        Effect.as(AudioPageResponse.cases.Unavailable.make({ principal })),
      ),
    ),
  )
})
