import { LINK_STATUS } from '@gbfm/core/status'
import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { FetchError, getErrorMessage } from '@/errors'
import { runEffect } from '@/lib/effect-hono'
import type { AppRouteHandler } from '@/lib/types'
import { AppRuntime, runAppFork } from '@/runtime'
import { ConfigService } from '@/services/config.service'
import { MusicEntityService } from '@/services/music-entity'
import { S3Service } from '@/services/s3.service'
import {
  isAppleMusicUrl,
  isBandcampUrl,
  isSpotifyUrl,
  isYouTubeUrl
} from '@/services/spotify.service'
import { getIdFromSpotifyUrl } from '@/services/url-utils'

import type {
  AddArtistToAlbumRoute,
  AddArtistToTrackRoute,
  AddEntityLinkRoute,
  AddSpotifyTrackToPlaylistRoute,
  AddTrackToPlaylistRoute,
  CreateAlbumRoute,
  CreateArtistRoute,
  CreatePlaylistRoute,
  CreateTrackRoute,
  DeleteAlbumRoute,
  DeleteArtistRoute,
  DeleteEntityLinkRoute,
  DeletePlaylistRoute,
  DeleteTrackRoute,
  GetAlbumRoute,
  GetArtistRoute,
  GetPlaylistRoute,
  GetPlaylistTracksRoute,
  GetTrackRoute,
  ImportSpotifyPlaylistRoute,
  ListAlbumsRoute,
  ListArtistsRoute,
  ListEntityLinksRoute,
  ListPendingLinksRoute,
  ListPlaylistsRoute,
  ListTracksRoute,
  RemoveArtistFromAlbumRoute,
  RemoveArtistFromTrackRoute,
  RemoveTrackFromPlaylistRoute,
  ReorderPlaylistTracksRoute,
  ResolveMusicEntityRoute,
  ScrapeEntityLinksRoute,
  SyncPlaylistLinksRoute,
  UpdateAlbumRoute,
  UpdateArtistRoute,
  UpdateEntityLinkStatusRoute,
  UpdatePlaylistRoute,
  UpdateTrackRoute
} from './music.routes'

// ---------------------------------------------------------------------------
// Artists
// ---------------------------------------------------------------------------

export const listArtists: AppRouteHandler<ListArtistsRoute> = async (c) => {
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getArtists()
  }).pipe(Effect.withSpan('api.music.listArtists'))

  return runEffect<ListArtistsRoute>(c, program)
}

export const createArtist: AppRouteHandler<CreateArtistRoute> = async (c) => {
  const body = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.createArtist({ ...body, createdById: user?.id ?? null })
  }).pipe(Effect.withSpan('api.music.createArtist'))

  return runEffect<CreateArtistRoute>(c, program, HttpStatusCodes.CREATED)
}

export const getArtist: AppRouteHandler<GetArtistRoute> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getArtistById(id)
  }).pipe(Effect.withSpan('api.music.getArtist', { attributes: { id } }))

  return runEffect<GetArtistRoute>(c, program)
}

export const updateArtist: AppRouteHandler<UpdateArtistRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.updateArtist(id, body)
  }).pipe(Effect.withSpan('api.music.updateArtist', { attributes: { id } }))

  return runEffect<UpdateArtistRoute>(c, program)
}

export const deleteArtist: AppRouteHandler<DeleteArtistRoute> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.deleteArtist(id)
    return { ok: true } as const
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.withSpan('api.music.deleteArtist', { attributes: { id } })
  )

  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result)
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------

export const listAlbums: AppRouteHandler<ListAlbumsRoute> = async (c) => {
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getAlbums()
  }).pipe(Effect.withSpan('api.music.listAlbums'))

  return runEffect<ListAlbumsRoute>(c, program)
}

export const createAlbum: AppRouteHandler<CreateAlbumRoute> = async (c) => {
  const body = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.createAlbum({ ...body, createdById: user?.id ?? null })
  }).pipe(Effect.withSpan('api.music.createAlbum'))

  return runEffect<CreateAlbumRoute>(c, program, HttpStatusCodes.CREATED)
}

export const getAlbum: AppRouteHandler<GetAlbumRoute> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getAlbumById(id)
  }).pipe(Effect.withSpan('api.music.getAlbum', { attributes: { id } }))

  return runEffect<GetAlbumRoute>(c, program)
}

export const updateAlbum: AppRouteHandler<UpdateAlbumRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.updateAlbum(id, body)
  }).pipe(Effect.withSpan('api.music.updateAlbum', { attributes: { id } }))

  return runEffect<UpdateAlbumRoute>(c, program)
}

export const deleteAlbum: AppRouteHandler<DeleteAlbumRoute> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.deleteAlbum(id)
    return { ok: true } as const
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.withSpan('api.music.deleteAlbum', { attributes: { id } })
  )

  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result)
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export const listTracks: AppRouteHandler<ListTracksRoute> = async (c) => {
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getTracks()
  }).pipe(Effect.withSpan('api.music.listTracks'))

  return runEffect<ListTracksRoute>(c, program)
}

export const createTrack: AppRouteHandler<CreateTrackRoute> = async (c) => {
  const body = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.createTrack({ ...body, createdById: user?.id ?? null })
  }).pipe(Effect.withSpan('api.music.createTrack'))

  return runEffect<CreateTrackRoute>(c, program, HttpStatusCodes.CREATED)
}

export const getTrack: AppRouteHandler<GetTrackRoute> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getTrackById(id)
  }).pipe(Effect.withSpan('api.music.getTrack', { attributes: { id } }))

  return runEffect<GetTrackRoute>(c, program)
}

export const updateTrack: AppRouteHandler<UpdateTrackRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.updateTrack(id, body)
  }).pipe(Effect.withSpan('api.music.updateTrack', { attributes: { id } }))

  return runEffect<UpdateTrackRoute>(c, program)
}

export const deleteTrack: AppRouteHandler<DeleteTrackRoute> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.deleteTrack(id)
    return { ok: true } as const
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.withSpan('api.music.deleteTrack', { attributes: { id } })
  )

  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result)
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

export const listPlaylists: AppRouteHandler<ListPlaylistsRoute> = async (c) => {
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getPlaylists()
  }).pipe(Effect.withSpan('api.music.listPlaylists'))

  return runEffect<ListPlaylistsRoute>(c, program)
}

export const createPlaylist: AppRouteHandler<CreatePlaylistRoute> = async (
  c
) => {
  const body = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.createPlaylist({ ...body, createdById: user?.id ?? null })
  }).pipe(Effect.withSpan('api.music.createPlaylist'))

  return runEffect<CreatePlaylistRoute>(c, program, HttpStatusCodes.CREATED)
}

export const getPlaylist: AppRouteHandler<GetPlaylistRoute> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getPlaylistById(id)
  }).pipe(Effect.withSpan('api.music.getPlaylist', { attributes: { id } }))

  return runEffect<GetPlaylistRoute>(c, program)
}

export const updatePlaylist: AppRouteHandler<UpdatePlaylistRoute> = async (
  c
) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.updatePlaylist(id, body)
  }).pipe(Effect.withSpan('api.music.updatePlaylist', { attributes: { id } }))

  return runEffect<UpdatePlaylistRoute>(c, program)
}

export const deletePlaylist: AppRouteHandler<DeletePlaylistRoute> = async (
  c
) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.deletePlaylist(id)
    return { ok: true } as const
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.withSpan('api.music.deletePlaylist', { attributes: { id } })
  )

  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result)
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Playlist tracks
// ---------------------------------------------------------------------------

export const getPlaylistTracks: AppRouteHandler<
  GetPlaylistTracksRoute
> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getPlaylistTracks(id)
  }).pipe(
    Effect.withSpan('api.music.getPlaylistTracks', { attributes: { id } })
  )

  return runEffect<GetPlaylistTracksRoute>(c, program)
}

export const addTrackToPlaylist: AppRouteHandler<
  AddTrackToPlaylistRoute
> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.addTrackToPlaylist(id, body.trackId, body.position)
  }).pipe(Effect.withSpan('api.music.addTrackToPlaylist'))

  return runEffect<AddTrackToPlaylistRoute>(c, program, HttpStatusCodes.CREATED)
}

export const removeTrackFromPlaylist: AppRouteHandler<
  RemoveTrackFromPlaylistRoute
> = async (c) => {
  const { id, trackId } = c.req.valid('param')

  await AppRuntime.runPromise(
    Effect.gen(function* () {
      const svc = yield* MusicEntityService
      yield* svc.removeTrackFromPlaylist(id, trackId)
    }).pipe(Effect.withSpan('api.music.removeTrackFromPlaylist'))
  )

  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

export const reorderPlaylistTracks: AppRouteHandler<
  ReorderPlaylistTracksRoute
> = async (c) => {
  const { id } = c.req.valid('param')
  const { trackIds } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.reorderPlaylistTracks(id, trackIds)
    return { ok: true } as const
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: e.message.includes('match current playlist tracks')
          ? HttpStatusCodes.BAD_REQUEST
          : HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    ),
    Effect.withSpan('api.music.reorderPlaylistTracks', { attributes: { id } })
  )

  const result = await AppRuntime.runPromise(program)
  if ('error' in result) return c.json({ error: result.error }, result.status)
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

export const addSpotifyTrackToPlaylist: AppRouteHandler<
  AddSpotifyTrackToPlaylistRoute
> = async (c) => {
  const { id } = c.req.valid('param')
  const { url } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.addSpotifyTrackToPlaylist(id, url)
  }).pipe(
    Effect.withSpan('api.music.addSpotifyTrackToPlaylist', {
      attributes: { id }
    })
  )

  return runEffect<AddSpotifyTrackToPlaylistRoute>(
    c,
    program,
    HttpStatusCodes.CREATED
  )
}

export const importSpotifyPlaylist: AppRouteHandler<
  ImportSpotifyPlaylistRoute
> = async (c) => {
  const { url } = c.req.valid('json')
  const user = c.get('user')

  const spotifyPlaylistId = getIdFromSpotifyUrl(url)
  if (!spotifyPlaylistId) {
    return c.json(
      { error: 'Could not extract Spotify playlist ID from URL' },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.importSpotifyPlaylist(url, user.id)
  }).pipe(
    Effect.catch((error) =>
      Effect.logError(
        '[MusicEntity] Background Spotify playlist import failed',
        {
          playlistId: spotifyPlaylistId,
          error: getErrorMessage(error)
        }
      )
    ),
    Effect.withSpan('api.music.importSpotifyPlaylist')
  )

  runAppFork(program)

  return c.json({ status: 'Queued' as const }, HttpStatusCodes.ACCEPTED)
}

export const syncPlaylistLinks: AppRouteHandler<
  SyncPlaylistLinksRoute
> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.syncPlaylistLinks(id)
  }).pipe(
    Effect.withSpan('api.music.syncPlaylistLinks', { attributes: { id } })
  )

  return runEffect<SyncPlaylistLinksRoute>(c, program)
}

// ---------------------------------------------------------------------------
// Resolve pasted URL into a music entity
// ---------------------------------------------------------------------------

const inferEntityTypeFromUrl = (url: string) => {
  if (isSpotifyUrl(url)) {
    if (url.includes('/album/')) return 'album' as const
    if (url.includes('/playlist/')) return 'playlist' as const
    return 'track' as const
  }
  if (isBandcampUrl(url)) return 'album' as const
  if (isAppleMusicUrl(url)) return 'track' as const
  if (isYouTubeUrl(url)) return 'track' as const
  return 'track' as const
}

const copyCoverImageEffect = (
  entityType: 'album' | 'track' | 'playlist',
  entityId: string,
  coverImageUrl: string
) =>
  Effect.gen(function* () {
    const config = yield* ConfigService
    const s3 = yield* S3Service

    const response = yield* Effect.tryPromise({
      try: () => fetch(coverImageUrl),
      catch: (cause) =>
        new FetchError({ message: `Failed to fetch ${coverImageUrl}`, cause })
    })

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = yield* Effect.tryPromise({
      try: () => response.arrayBuffer(),
      catch: (cause) =>
        new FetchError({ message: `Failed to read ${coverImageUrl}`, cause })
    })
    const buffer = Buffer.from(arrayBuffer)
    const key = `music/${entityType}/${entityId}/cover`
    const uploadedKey = yield* s3.uploadFile(
      key,
      buffer,
      contentType,
      config.buckets.userContent
    )
    return `${config.urls.router}/user-content/${uploadedKey}`
  }).pipe(Effect.catch(() => Effect.succeed(null)))

export const resolveMusicEntity: AppRouteHandler<
  ResolveMusicEntityRoute
> = async (c) => {
  const { url } = c.req.valid('json')
  const entityType = inferEntityTypeFromUrl(url)

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    const result = yield* svc.scrapeAndCreateEntity(entityType, { url })
    const entity = result.entity
    const coverImageUrl =
      'coverImageUrl' in entity ? entity.coverImageUrl : null

    if (coverImageUrl) {
      const publicCoverImageUrl = yield* copyCoverImageEffect(
        entityType,
        entity.id,
        coverImageUrl
      )

      if (publicCoverImageUrl && publicCoverImageUrl !== coverImageUrl) {
        switch (entityType) {
          case 'album':
            yield* svc.updateAlbum(entity.id, {
              coverImageUrl: publicCoverImageUrl
            })
            break
          case 'track':
            yield* svc.updateTrack(entity.id, {
              coverImageUrl: publicCoverImageUrl
            })
            break
          case 'playlist':
            yield* svc.updatePlaylist(entity.id, {
              coverImageUrl: publicCoverImageUrl
            })
            break
        }
        return {
          entity: { ...entity, coverImageUrl: publicCoverImageUrl },
          entityType,
          links: result.links,
          coverImageUrl: publicCoverImageUrl
        } as const
      }
    }

    return { entity, entityType, links: result.links, coverImageUrl } as const
  }).pipe(
    Effect.withSpan('api.music.resolveMusicEntity', { attributes: { url } })
  )

  return runEffect<ResolveMusicEntityRoute>(c, program)
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export const listEntityLinks: AppRouteHandler<ListEntityLinksRoute> = async (
  c
) => {
  const { entityType, entityId } = c.req.valid('param')
  const { status } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getLinksForEntity(entityType, entityId, status)
  }).pipe(
    Effect.withSpan('api.music.listEntityLinks', {
      attributes: { entityType, entityId }
    })
  )

  return runEffect<ListEntityLinksRoute>(c, program)
}

export const addEntityLink: AppRouteHandler<AddEntityLinkRoute> = async (c) => {
  const { entityType, entityId } = c.req.valid('param')
  const { platform, url, status } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.addLink({ entityType, entityId, platform, url, status })
  }).pipe(
    Effect.withSpan('api.music.addEntityLink', {
      attributes: { entityType, entityId, platform }
    })
  )

  return runEffect<AddEntityLinkRoute>(c, program, HttpStatusCodes.CREATED)
}

export const updateEntityLinkStatus: AppRouteHandler<
  UpdateEntityLinkStatusRoute
> = async (c) => {
  const { entityType, entityId, linkId } = c.req.valid('param')
  const { status, metadata } = c.req.valid('json')
  const user = c.get('user')
  const userId = status === LINK_STATUS.VERIFIED ? user.id : undefined

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.updateLinkStatus(
      entityType,
      entityId,
      linkId,
      status,
      userId,
      metadata
    )
  }).pipe(
    Effect.withSpan('api.music.updateEntityLinkStatus', {
      attributes: { entityType, entityId, linkId, status, userId }
    })
  )

  return runEffect<UpdateEntityLinkStatusRoute>(c, program)
}

export const deleteEntityLink: AppRouteHandler<DeleteEntityLinkRoute> = async (
  c
) => {
  const { entityType, entityId, linkId } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.deleteLink(entityType, entityId, linkId)
    return { ok: true } as const
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.withSpan('api.music.deleteEntityLink', {
      attributes: { entityType, entityId, linkId }
    })
  )

  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result)
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Scrape
// ---------------------------------------------------------------------------

export const scrapeEntityLinks: AppRouteHandler<
  ScrapeEntityLinksRoute
> = async (c) => {
  const { entityType } = c.req.valid('param')
  const input = c.req.valid('json')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.scrapeAndCreateEntity(entityType, input)
  }).pipe(
    Effect.withSpan('api.music.scrapeEntityLinks', {
      attributes: { entityType }
    })
  )

  return runEffect<ScrapeEntityLinksRoute>(c, program)
}

// ---------------------------------------------------------------------------
// Artist ↔ album / track junctions
// ---------------------------------------------------------------------------

export const addArtistToAlbum: AppRouteHandler<AddArtistToAlbumRoute> = async (
  c
) => {
  const { albumId, artistId } = c.req.valid('param')
  const body = c.req.valid('json')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.addArtistToAlbum(albumId, artistId, body)
    return { ok: true } as const
  }).pipe(
    Effect.withSpan('api.music.addArtistToAlbum', {
      attributes: { albumId, artistId }
    })
  )

  const result = await AppRuntime.runPromise(program)
  if ('error' in result)
    return c.json(
      { error: (result as { error: string }).error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

export const removeArtistFromAlbum: AppRouteHandler<
  RemoveArtistFromAlbumRoute
> = async (c) => {
  const { albumId, artistId } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.removeArtistFromAlbum(albumId, artistId)
  }).pipe(
    Effect.withSpan('api.music.removeArtistFromAlbum', {
      attributes: { albumId, artistId }
    })
  )

  await AppRuntime.runPromise(program)
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

export const addArtistToTrack: AppRouteHandler<AddArtistToTrackRoute> = async (
  c
) => {
  const { trackId, artistId } = c.req.valid('param')
  const body = c.req.valid('json')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.addArtistToTrack(trackId, artistId, body)
  }).pipe(
    Effect.withSpan('api.music.addArtistToTrack', {
      attributes: { trackId, artistId }
    })
  )

  await AppRuntime.runPromise(program)
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

export const removeArtistFromTrack: AppRouteHandler<
  RemoveArtistFromTrackRoute
> = async (c) => {
  const { trackId, artistId } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.removeArtistFromTrack(trackId, artistId)
  }).pipe(
    Effect.withSpan('api.music.removeArtistFromTrack', {
      attributes: { trackId, artistId }
    })
  )

  await AppRuntime.runPromise(program)
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export const listPendingLinks: AppRouteHandler<ListPendingLinksRoute> = async (
  c
) => {
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getPendingLinks({ limit, offset })
  }).pipe(Effect.withSpan('api.music.listPendingLinks'))

  return runEffect<ListPendingLinksRoute>(c, program)
}
