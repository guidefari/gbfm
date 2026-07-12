import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import type {
  AlbumResponse,
  ArtistResponse,
  CreateAlbumInput,
  CreateArtistInput,
  CreatePlaylistInput,
  CreateTrackInput,
  PlaylistResponse,
  TrackResponse,
  UpdateAlbumInput,
  UpdateArtistInput,
  UpdatePlaylistInput,
  UpdateTrackInput
} from '@gbfm/api/music'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import type {
  SelectMusicAlbum,
  SelectMusicArtist,
  SelectMusicPlaylist,
  SelectMusicTrack
} from '@/db/music-entity.schema'
import { getErrorMessage } from '@/errors'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { runAppFork } from '@/runtime'
import { MusicEntityService } from '@/services/music-entity'
import { getIdFromSpotifyUrl } from '@/services/url-utils'

const toArtistResponse = (row: SelectMusicArtist): ArtistResponse => ({
  ...row,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
})

const toAlbumResponse = (row: SelectMusicAlbum): AlbumResponse => ({
  ...row,
  releaseDate: row.releaseDate?.toISOString() ?? null,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
})

const toTrackResponse = (row: SelectMusicTrack): TrackResponse => ({
  ...row,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
})

const toPlaylistResponse = (
  row: SelectMusicPlaylist & { spotifyUrl?: string | null }
): PlaylistResponse => ({
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

const toAlbumServiceFields = <T extends CreateAlbumInput | UpdateAlbumInput>(
  input: T
): Omit<T, 'artistNames' | 'artistIds' | 'genres' | 'releaseDate' | 'publishedAt'> & {
  artistNames?: string[]
  artistIds?: string[]
  genres?: string[]
  releaseDate?: Date
  publishedAt?: Date
} => ({
  ...input,
  artistNames: input.artistNames ? [...input.artistNames] : undefined,
  artistIds: input.artistIds ? [...input.artistIds] : undefined,
  genres: input.genres ? [...input.genres] : undefined,
  releaseDate: input.releaseDate ? new Date(input.releaseDate) : undefined,
  publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined
})

const toTrackServiceFields = <T extends CreateTrackInput | UpdateTrackInput>(
  input: T
): Omit<T, 'artistNames' | 'artistIds' | 'publishedAt'> & {
  artistNames?: string[]
  artistIds?: string[]
  publishedAt?: Date
} => ({
  ...input,
  artistNames: input.artistNames ? [...input.artistNames] : undefined,
  artistIds: input.artistIds ? [...input.artistIds] : undefined,
  publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined
})

const toPlaylistServiceFields = <T extends CreatePlaylistInput | UpdatePlaylistInput>(
  input: T
): Omit<T, 'publishedAt'> & { publishedAt?: Date } => ({
  ...input,
  publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined
})

const dieOnDatabaseError = makeDieOnDatabaseError('music')

// SpotifyError is an infra failure (network/API), not client-fixable by
// resubmitting differently, except where the handler already validates the
// URL shape itself (importSpotifyPlaylist) -- same convention as
// dieOnDatabaseError/dieOnS3Error in handler-utils.ts.
const dieOnSpotifyError = <A, E, R>(
  effect: Effect.Effect<A, E | { readonly _tag: 'SpotifyError' }, R>
) =>
  effect.pipe(
    Effect.tapErrorTag('SpotifyError', (cause) =>
      Effect.logError('[music] spotify operation failed', cause)
    ),
    Effect.catchTag('SpotifyError', (cause) => Effect.die(cause))
  )

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
    // -----------------------------------------------------------------
    // Albums
    // -----------------------------------------------------------------
    .handle('listAlbums', () =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getAlbums())
        return rows.map(toAlbumResponse)
      })
    )
    .handle('createAlbum', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user } = yield* AuthSession
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc.createAlbum({ ...toAlbumServiceFields(payload), createdById: user.id })
        )
        return toAlbumResponse(row)
      })
    )
    .handle('getAlbum', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .getAlbumById(params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return toAlbumResponse(row)
      })
    )
    .handle('updateAlbum', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .updateAlbum(params.id, toAlbumServiceFields(payload))
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return toAlbumResponse(row)
      })
    )
    .handle('deleteAlbum', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(
          svc
            .deleteAlbum(params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
      })
    )
    // -----------------------------------------------------------------
    // Tracks
    // -----------------------------------------------------------------
    .handle('listTracks', () =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getTracks())
        return rows.map(toTrackResponse)
      })
    )
    .handle('createTrack', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user } = yield* AuthSession
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc.createTrack({ ...toTrackServiceFields(payload), createdById: user.id })
        )
        return toTrackResponse(row)
      })
    )
    .handle('getTrack', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .getTrackById(params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return toTrackResponse(row)
      })
    )
    .handle('updateTrack', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .updateTrack(params.id, toTrackServiceFields(payload))
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return toTrackResponse(row)
      })
    )
    .handle('deleteTrack', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(
          svc
            .deleteTrack(params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
      })
    )
    // -----------------------------------------------------------------
    // Playlists
    // -----------------------------------------------------------------
    .handle('listPlaylists', () =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getPlaylists())
        return rows.map(toPlaylistResponse)
      })
    )
    .handle('createPlaylist', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user } = yield* AuthSession
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc.createPlaylist({ ...toPlaylistServiceFields(payload), createdById: user.id })
        )
        return toPlaylistResponse(row)
      })
    )
    .handle('getPlaylist', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .getPlaylistById(params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return toPlaylistResponse(row)
      })
    )
    .handle('updatePlaylist', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .updatePlaylist(params.id, toPlaylistServiceFields(payload))
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return toPlaylistResponse(row)
      })
    )
    .handle('deletePlaylist', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(
          svc
            .deletePlaylist(params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
      })
    )
    // -----------------------------------------------------------------
    // Playlist tracks
    // -----------------------------------------------------------------
    .handle('getPlaylistTracks', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getPlaylistTracks(params.id))
        return rows.map((entry) => ({
          track: toTrackResponse(entry.track),
          position: entry.position,
          addedAt: entry.addedAt.toISOString(),
          links: entry.links
        }))
      })
    )
    .handle('addTrackToPlaylist', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc.addTrackToPlaylist(params.id, payload.trackId, payload.position)
        )
        return {
          playlistId: row.playlistId,
          trackId: row.trackId,
          position: row.position,
          addedAt: row.addedAt.toISOString()
        }
      })
    )
    .handle('removeTrackFromPlaylist', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(svc.removeTrackFromPlaylist(params.id, params.trackId))
      })
    )
    .handle('reorderPlaylistTracks', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* svc
          .reorderPlaylistTracks(params.id, [...payload.trackIds])
          .pipe(
            Effect.catchTag('DatabaseError', (cause) =>
              cause.message.includes('match current playlist tracks')
                ? new HttpApiError.BadRequest()
                : Effect.die(cause)
            )
          )
      })
    )
    .handle('addSpotifyTrackToPlaylist', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        return yield* dieOnDatabaseError(
          dieOnSpotifyError(svc.addSpotifyTrackToPlaylist(params.id, payload.url))
        )
      })
    )
    .handle('importSpotifyPlaylist', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user } = yield* AuthSession
        const svc = yield* MusicEntityService

        const spotifyPlaylistId = getIdFromSpotifyUrl(payload.url)
        if (!spotifyPlaylistId) {
          return yield* new HttpApiError.BadRequest()
        }

        const program = svc.importSpotifyPlaylist(payload.url, user.id).pipe(
          Effect.asVoid,
          Effect.catch((error) =>
            Effect.logError('[music] Background Spotify playlist import failed', {
              playlistId: spotifyPlaylistId,
              error: getErrorMessage(error)
            })
          )
        )
        runAppFork(program)

        return { status: 'Queued' as const }
      })
    )
    .handle('syncPlaylistLinks', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        return yield* dieOnDatabaseError(dieOnSpotifyError(svc.syncPlaylistLinks(params.id)))
      })
    )
)
