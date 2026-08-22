import { Api } from '@gbfm/api/api'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { SpotifyService, type SpotifyServiceError } from '@/services/spotify.service'

const toHttpError = (error: SpotifyServiceError) =>
  Effect.gen(function* () {
    yield* Effect.logError('[spotify] request failed', error)
    return error._tag === 'MusicProviderInvalidInput'
      ? yield* new HttpApiError.BadRequest()
      : yield* new HttpApiError.InternalServerError()
  })

export const SpotifyHandlersLive = HttpApiBuilder.group(Api, 'spotify', (handlers) =>
  handlers
    .handle('getSpotifyTrack', ({ payload }) =>
      Effect.gen(function* () {
        const svc = yield* SpotifyService
        return yield* svc.getTrack(payload.id).pipe(Effect.catch(toHttpError))
      }).pipe(Effect.withSpan('api.spotify.getTrack', { attributes: { id: payload.id } }))
    )
    .handle('getSpotifyAlbum', ({ payload }) =>
      Effect.gen(function* () {
        const svc = yield* SpotifyService
        return yield* svc.getAlbum(payload.id).pipe(Effect.catch(toHttpError))
      })
    )
    .handle('getSpotifyPlaylist', ({ payload }) =>
      Effect.gen(function* () {
        const svc = yield* SpotifyService
        return yield* svc.getPlaylist(payload.id).pipe(Effect.catch(toHttpError))
      })
    )
    .handle('searchSpotifyAlbums', ({ payload }) =>
      Effect.gen(function* () {
        const svc = yield* SpotifyService
        return yield* svc
          .searchAlbums(payload.query, payload.limit ?? 10, payload.offset ?? 0)
          .pipe(Effect.catch(toHttpError))
      })
    )
    .handle('enrichSpotifyTrackFromUrl', ({ payload }) =>
      Effect.gen(function* () {
        const svc = yield* SpotifyService
        return yield* svc.enrichTrackFromUrl(payload.url.toString()).pipe(Effect.catch(toHttpError))
      })
    )
)
