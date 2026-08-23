import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import type {
  AlbumResponse,
  ArtistResponse,
  CreateAlbumInput,
  CreateArtistInput,
  CreateLabelInput,
  CreatePlaylistInput,
  CreateTrackInput,
  EntityLinkResponse,
  LabelResponse,
  PlaylistResponse,
  TrackResponse,
  UpdateAlbumInput,
  UpdateArtistInput,
  UpdateLabelInput,
  UpdatePlaylistInput,
  UpdateTrackInput
} from '@gbfm/api/music'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { musicEntityMetadataSchema } from '@/db/music-entity.schema'
import type {
  SelectMusicAlbum,
  SelectMusicArtist,
  SelectMusicEntityLink,
  MusicEntityMetadataValue,
  SelectMdxCompiledMusicLabel,
  SelectMusicLabel,
  SelectMusicPlaylist,
  SelectMusicTrack
} from '@/db/music-entity.schema'
import { getErrorMessage, type MusicProviderError } from '@/errors'
import {
  dieOnDatabaseError as makeDieOnDatabaseError,
  dieOnS3Error as makeDieOnS3Error
} from '@/http/handler-utils'
import { ConfigService } from '@/services/config.service'
import { copyMusicCoverImageEffect } from '@/services/music-cover-image.service'
import {
  type CreateAlbumInput as AlbumServiceCreateInput,
  type CreateLabelInput as LabelServiceCreateInput,
  type CreatePlaylistInput as PlaylistServiceCreateInput,
  type CreateTrackInput as TrackServiceCreateInput,
  MusicEntityResolutionUnavailable,
  MusicEntityService
} from '@/services/music-entity'
import { S3Service } from '@/services/s3.service'
import {
  isAppleMusicUrl,
  isBandcampUrl,
  isSpotifyUrl,
  isYouTubeUrl
} from '@/services/spotify.service'
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

const toLabelResponse = (row: SelectMusicLabel | SelectMdxCompiledMusicLabel): LabelResponse => ({
  ...row,
  tags: row.tags ? [...row.tags] : null,
  genres: row.genres ? [...row.genres] : null,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
})

const toEntityLinkResponse = (row: SelectMusicEntityLink): EntityLinkResponse => ({
  ...row,
  scrapedAt: row.scrapedAt?.toISOString() ?? null,
  verifiedAt: row.verifiedAt?.toISOString() ?? null,
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

// Create: title/slug are required NonEmptyString on the wire schema, so no
// null-coercion is needed -- only the array/date fields need reshaping.
const toAlbumCreateFields = (input: CreateAlbumInput): AlbumServiceCreateInput => ({
  ...input,
  artistNames: input.artistNames ? [...input.artistNames] : undefined,
  artistIds: input.artistIds ? [...input.artistIds] : undefined,
  genres: input.genres ? [...input.genres] : undefined,
  releaseDate: input.releaseDate ? new Date(input.releaseDate) : undefined,
  publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined
})

// Update: every field (including title/slug) is optional+nullable on the
// wire schema since the admin form submits full state, not a diff. The DB
// columns are non-nullable, so a null here means "no change", not "clear
// this field" -- coerced to undefined before reaching the service.
const toAlbumUpdateFields = (input: UpdateAlbumInput): Partial<AlbumServiceCreateInput> => ({
  ...input,
  title: input.title ?? undefined,
  slug: input.slug ?? undefined,
  artistNames: input.artistNames ? [...input.artistNames] : undefined,
  artistIds: input.artistIds ? [...input.artistIds] : undefined,
  genres: input.genres ? [...input.genres] : undefined,
  releaseDate: input.releaseDate ? new Date(input.releaseDate) : undefined,
  publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined
})

const toTrackCreateFields = (input: CreateTrackInput): TrackServiceCreateInput => ({
  ...input,
  artistNames: input.artistNames ? [...input.artistNames] : undefined,
  artistIds: input.artistIds ? [...input.artistIds] : undefined,
  publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined
})

const toTrackUpdateFields = (input: UpdateTrackInput): Partial<TrackServiceCreateInput> => ({
  ...input,
  title: input.title ?? undefined,
  slug: input.slug ?? undefined,
  artistNames: input.artistNames ? [...input.artistNames] : undefined,
  artistIds: input.artistIds ? [...input.artistIds] : undefined,
  publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined
})

const toPlaylistCreateFields = (input: CreatePlaylistInput): PlaylistServiceCreateInput => ({
  ...input,
  publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined
})

const toPlaylistUpdateFields = (
  input: UpdatePlaylistInput
): Partial<PlaylistServiceCreateInput> => ({
  ...input,
  title: input.title ?? undefined,
  slug: input.slug ?? undefined,
  publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined
})

const toLabelCreateFields = (input: CreateLabelInput): LabelServiceCreateInput => ({
  ...input,
  tags: input.tags ? [...input.tags] : undefined,
  genres: input.genres ? [...input.genres] : undefined,
  publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined
})

const toLabelUpdateFields = (input: UpdateLabelInput): Partial<LabelServiceCreateInput> => ({
  ...input,
  name: input.name ?? undefined,
  slug: input.slug ?? undefined,
  content: input.content ?? undefined,
  tags: input.tags ? [...input.tags] : input.tags,
  genres: input.genres ? [...input.genres] : input.genres,
  publishedAt:
    input.publishedAt === null ? null : input.publishedAt ? new Date(input.publishedAt) : undefined
})

const dieOnDatabaseError = makeDieOnDatabaseError('music')
const dieOnS3Error = makeDieOnS3Error('music')

// A music provider failure is an infra failure (network/API), not
// client-fixable by resubmitting differently, except where the handler
// already validates the URL shape itself (importSpotifyPlaylist) -- same
// convention as dieOnDatabaseError/dieOnS3Error in handler-utils.ts.
const MUSIC_PROVIDER_ERROR_TAGS = [
  'MusicProviderInvalidInput',
  'MusicProviderNotFound',
  'MusicProviderMisconfigured',
  'MusicProviderRequestFailed',
  'MusicProviderResponseInvalid'
] as const

const dieOnMusicProviderError = <A, E, R>(effect: Effect.Effect<A, E | MusicProviderError, R>) =>
  effect.pipe(
    Effect.tapErrorTag(MUSIC_PROVIDER_ERROR_TAGS, (cause) =>
      Effect.logError('[music] music provider operation failed', cause)
    ),
    Effect.catchTag(MUSIC_PROVIDER_ERROR_TAGS, (cause) => Effect.die(cause))
  )

const requireAdmin = Effect.gen(function* () {
  const { user } = yield* AuthSession
  if (user.role !== 'admin') {
    return yield* new HttpApiError.Forbidden()
  }

  return undefined
})

// scrapeAndCreateEntity returns a raw Drizzle row (Date fields, entity-type
// dependent shape) but the API contract treats the resolved/scraped entity
// as an opaque JSON record (ResolvedMusicEntityResponse/
// ScrapeEntityLinksResponse both use Schema.Record) -- same looseness the
// old Hono handler had via z.record(z.string(), z.unknown()). Dates need
// converting or they'd serialize inconsistently.
type JsonEntityValue = MusicEntityMetadataValue | Date

const toJsonEntity = (
  entity: Record<string, JsonEntityValue>
): Record<string, MusicEntityMetadataValue> =>
  Object.fromEntries(
    Object.entries(entity).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value
    ])
  )

const inferEntityTypeFromUrl = (url: string): 'album' | 'track' | 'playlist' => {
  if (isSpotifyUrl(url)) {
    if (url.includes('/album/')) return 'album'
    if (url.includes('/playlist/')) return 'playlist'
    return 'track'
  }
  if (/^https:\/\/(?:www\.)?deezer\.com\//.test(url)) {
    if (/\/album\/\d+/.test(url)) return 'album'
    if (/\/playlist\/\d+/.test(url)) return 'playlist'
    return 'track'
  }
  if (isBandcampUrl(url)) return 'album'
  if (isAppleMusicUrl(url)) return 'track'
  if (isYouTubeUrl(url)) return 'track'
  return 'track'
}

export const MusicHandlersLive = HttpApiBuilder.group(Api, 'music', (handlers) =>
  handlers
    .handle('listArtists', () =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getArtists)
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
    .handle('listArtistLabels', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getLabelsForArtist(params.artistId))
        return rows.map(toLabelResponse)
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
        const rows = yield* dieOnDatabaseError(svc.getAlbums)
        return rows.map(toAlbumResponse)
      })
    )
    .handle('createAlbum', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user } = yield* AuthSession
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc.createAlbum({ ...toAlbumCreateFields(payload), createdById: user.id })
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
            .updateAlbum(params.id, toAlbumUpdateFields(payload))
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
    .handle('listAlbumLabels', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getLabelsForAlbum(params.albumId))
        return rows.map(toLabelResponse)
      })
    )
    // -----------------------------------------------------------------
    // Tracks
    // -----------------------------------------------------------------
    .handle('listTracks', () =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getTracks)
        return rows.map(toTrackResponse)
      })
    )
    .handle('createTrack', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user } = yield* AuthSession
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc.createTrack({ ...toTrackCreateFields(payload), createdById: user.id })
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
            .updateTrack(params.id, toTrackUpdateFields(payload))
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
        const rows = yield* dieOnDatabaseError(svc.getPlaylists)
        return rows.map(toPlaylistResponse)
      })
    )
    .handle('createPlaylist', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user } = yield* AuthSession
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc.createPlaylist({ ...toPlaylistCreateFields(payload), createdById: user.id })
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
            .updatePlaylist(params.id, toPlaylistUpdateFields(payload))
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
    .handle('listLabels', () =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getLabels(false))
        return rows.map(toLabelResponse)
      })
    )
    .handle('listLabelsForAdmin', () =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getLabels(true))
        return rows.map(toLabelResponse)
      })
    )
    .handle('createLabel', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user } = yield* AuthSession
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc.createLabel({ ...toLabelCreateFields(payload), createdById: user.id })
        )
        return toLabelResponse(row)
      })
    )
    .handle('getLabelBySlug', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .getLabelBySlug(params.slug)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        const [artists, albums] = yield* dieOnDatabaseError(
          Effect.all([
            svc.getPublishedArtistsForLabel(row.id),
            svc.getPublishedAlbumsForLabel(row.id)
          ])
        )
        return {
          ...toLabelResponse(row),
          affiliatedArtists: artists.map(toArtistResponse),
          affiliatedAlbums: albums.map(toAlbumResponse)
        }
      })
    )
    .handle('getLabel', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .getLabelById(params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return toLabelResponse(row)
      })
    )
    .handle('updateLabel', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .updateLabel(params.id, toLabelUpdateFields(payload))
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return toLabelResponse(row)
      })
    )
    .handle('deleteLabel', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(
          svc
            .deleteLabel(params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
      })
    )
    .handle('listLabelArtists', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getArtistsForLabel(params.labelId))
        return rows.map(toArtistResponse)
      })
    )
    .handle('listLabelAlbums', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(svc.getAlbumsForLabel(params.labelId))
        return rows.map(toAlbumResponse)
      })
    )
    .handle('affiliateArtistWithLabel', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(
          svc
            .affiliateArtistWithLabel(params.labelId, params.artistId)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
      })
    )
    .handle('unaffiliateArtistFromLabel', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(svc.unaffiliateArtistFromLabel(params.labelId, params.artistId))
      })
    )
    .handle('affiliateAlbumWithLabel', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(
          svc
            .affiliateAlbumWithLabel(params.labelId, params.albumId)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
      })
    )
    .handle('unaffiliateAlbumFromLabel', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(svc.unaffiliateAlbumFromLabel(params.labelId, params.albumId))
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
        // MusicProviderInvalidInput means the service itself couldn't parse a
        // track ID out of the URL -- a client-fixable validation error, not
        // an infra failure, so it's mapped to BadRequest instead of dying.
        const result = yield* svc.addSpotifyTrackToPlaylist(params.id, payload.url).pipe(
          Effect.catchTag('MusicProviderInvalidInput', () => new HttpApiError.BadRequest()),
          dieOnMusicProviderError,
          dieOnDatabaseError
        )
        return result
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
        yield* Effect.forkDetach(program)

        return { status: 'Queued' as const }
      })
    )
    .handle('syncPlaylistLinks', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        return yield* dieOnDatabaseError(dieOnMusicProviderError(svc.syncPlaylistLinks(params.id)))
      })
    )
    // -----------------------------------------------------------------
    // Resolve a pasted URL into a music entity
    // -----------------------------------------------------------------
    .handle('resolveMusicEntity', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const entityType = inferEntityTypeFromUrl(payload.url)

        const result = yield* dieOnDatabaseError(
          svc.scrapeAndCreateEntity(entityType, { url: payload.url }).pipe(
            Effect.catchTag('ValidationError', () => Effect.fail(new HttpApiError.BadRequest())),
            Effect.catchTag('MusicScraperError', (error) =>
              Effect.gen(function* () {
                if (error.statusCode === 400 || error.statusCode === 404) {
                  return yield* new HttpApiError.BadRequest()
                }
                return yield* new HttpApiError.ServiceUnavailable()
              })
            ),
            Effect.catchTag(
              'MusicEntityResolutionUnavailable',
              () => new HttpApiError.ServiceUnavailable()
            )
          )
        )
        const entity = result.entity
        const coverImageUrl = 'coverImageUrl' in entity ? entity.coverImageUrl : null

        if (coverImageUrl) {
          const config = yield* ConfigService
          const s3 = yield* S3Service
          const publicCoverImageUrl = yield* dieOnS3Error(
            copyMusicCoverImageEffect(
              s3,
              config.urls.bucketRouter,
              config.buckets.userContent,
              entityType,
              entity.id,
              coverImageUrl
            )
          )

          if (publicCoverImageUrl && publicCoverImageUrl !== coverImageUrl) {
            if (entityType === 'album') {
              yield* dieOnDatabaseError(
                svc.updateAlbum(entity.id, { coverImageUrl: publicCoverImageUrl })
              ).pipe(Effect.catchTag('NotFoundError', () => Effect.void))
            } else if (entityType === 'track') {
              yield* dieOnDatabaseError(
                svc.updateTrack(entity.id, { coverImageUrl: publicCoverImageUrl })
              ).pipe(Effect.catchTag('NotFoundError', () => Effect.void))
            } else {
              yield* dieOnDatabaseError(
                svc.updatePlaylist(entity.id, { coverImageUrl: publicCoverImageUrl })
              ).pipe(Effect.catchTag('NotFoundError', () => Effect.void))
            }
            return {
              entity: toJsonEntity({ ...entity, coverImageUrl: publicCoverImageUrl }),
              entityType,
              links: result.links.map(toEntityLinkResponse),
              coverImageUrl: publicCoverImageUrl
            }
          }
        }

        return {
          entity: toJsonEntity(entity),
          entityType,
          links: result.links.map(toEntityLinkResponse),
          coverImageUrl
        }
      })
    )
    // -----------------------------------------------------------------
    // Links
    // -----------------------------------------------------------------
    .handle('listEntityLinks', ({ params, query }) =>
      Effect.gen(function* () {
        const svc = yield* MusicEntityService
        const rows = yield* dieOnDatabaseError(
          svc.getLinksForEntity(params.entityType, params.entityId, query.status)
        )
        return rows.map(toEntityLinkResponse)
      })
    )
    .handle('addEntityLink', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc.addLink({
            entityType: params.entityType,
            entityId: params.entityId,
            platform: payload.platform,
            url: payload.url,
            status: payload.status
          })
        )
        return toEntityLinkResponse(row)
      })
    )
    .handle('updateEntityLinkStatus', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user } = yield* AuthSession
        const userId = payload.status === 'verified' ? user.id : undefined
        const svc = yield* MusicEntityService
        const row = yield* dieOnDatabaseError(
          svc
            .updateLinkStatus(
              params.entityType,
              params.entityId,
              params.linkId,
              payload.status,
              userId,
              payload.metadata === undefined
                ? undefined
                : musicEntityMetadataSchema.parse(payload.metadata)
            )
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return toEntityLinkResponse(row)
      })
    )
    .handle('deleteEntityLink', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        yield* dieOnDatabaseError(
          svc
            .deleteLink(params.entityType, params.entityId, params.linkId)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
      })
    )
    .handle('rescrapeEntityLinks', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* MusicEntityService
        const result = yield* dieOnDatabaseError(
          svc.refreshEntityLinks(params.entityType, params.entityId).pipe(
            Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
            Effect.catchTag('MusicScraperError', () => new HttpApiError.ServiceUnavailable())
          )
        )
        return { links: result.links.map(toEntityLinkResponse) }
      })
    )
    // -----------------------------------------------------------------
    // Scrape
    // -----------------------------------------------------------------
    .handle('scrapeEntityLinks', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        // Every field is optional, but at least one real lookup key is
        // required -- an all-empty payload would otherwise reach the
        // scraper with nothing to search on and insert a placeholder
        // ("Untitled Album" etc) row. The old Hono route's docstring said
        // "provide at least one field" but never actually enforced it;
        // enforcing it here rather than carrying the gap forward.
        const hasAnyField = Object.values(payload).some((value) => value !== undefined)
        if (!hasAnyField) {
          return yield* new HttpApiError.BadRequest()
        }
        const svc = yield* MusicEntityService
        const result = yield* dieOnDatabaseError(
          svc.scrapeAndCreateEntity(params.entityType, payload).pipe(
            Effect.catchTag('ValidationError', () => Effect.fail(new HttpApiError.BadRequest())),
            Effect.catchTag('MusicScraperError', (error) =>
              Effect.gen(function* () {
                if (error.statusCode === 400 || error.statusCode === 404) {
                  return yield* new HttpApiError.BadRequest()
                }
                return yield* new HttpApiError.ServiceUnavailable()
              })
            ),
            Effect.catchTag(
              'MusicEntityResolutionUnavailable',
              () => new HttpApiError.ServiceUnavailable()
            )
          )
        )
        return {
          entity: toJsonEntity(result.entity),
          links: result.links.map(toEntityLinkResponse)
        }
      })
    )
)
