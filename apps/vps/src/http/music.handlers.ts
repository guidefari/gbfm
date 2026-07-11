import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import type { ArtistResponse, CreateArtistInput, UpdateArtistInput } from '@gbfm/api/music'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import type { SelectMusicArtist } from '@/db/music-entity.schema'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { MusicEntityService } from '@/services/music-entity'

const toArtistResponse = (row: SelectMusicArtist): ArtistResponse => ({
  ...row,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
})

// Generic so create keeps slug/name required and update keeps them optional.
const toServiceFields = <T extends CreateArtistInput | UpdateArtistInput>(
  input: T
): Omit<T, 'genres' | 'publishedAt'> & { genres?: string[]; publishedAt?: Date } => ({
  ...input,
  genres: input.genres ? [...input.genres] : undefined,
  publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined
})

const dieOnDatabaseError = makeDieOnDatabaseError('music')

const requireAdmin = Effect.gen(function* () {
  const { user } = yield* AuthSession
  if (user.role !== 'admin') {
    return yield* new HttpApiError.Forbidden()
  }
})

export const MusicHandlersLive = HttpApiBuilder.group(Api, 'music', (handlers) =>
  handlers
    .handle('listArtists', () =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getArtists())
        return rows.map(toArtistResponse)
      })
    )
    .handle('createArtist', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user } = yield* AuthSession
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc.createArtist({ ...toServiceFields(payload), createdById: user.id })
        )
        return toArtistResponse(row)
      })
    )
    .handle('getArtist', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .getArtistById(params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return toArtistResponse(row)
      })
    )
    .handle('updateArtist', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .updateArtist(params.id, toServiceFields(payload))
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return toArtistResponse(row)
      })
    )
    .handle('deleteArtist', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(
          svc
            .deleteArtist(params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
      })
    )
    .handle('addArtistToAlbum', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(svc.addArtistToAlbum(params.albumId, params.artistId, payload))
      })
    )
    .handle('removeArtistFromAlbum', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(svc.removeArtistFromAlbum(params.albumId, params.artistId))
      })
    )
    .handle('addArtistToTrack', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(svc.addArtistToTrack(params.trackId, params.artistId, payload))
      })
    )
    .handle('removeArtistFromTrack', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(svc.removeArtistFromTrack(params.trackId, params.artistId))
      })
    )
)
