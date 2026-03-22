import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { AppRuntime } from '@/runtime'
import { MusicEntityService } from '@/services/music-entity.service'
import type {
  AddArtistToAlbumRoute,
  AddArtistToTrackRoute,
  AddEntityLinkRoute,
  AddPlaylistTrackRoute,
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
  GetTrackRoute,
  ListAlbumsRoute,
  ListArtistsRoute,
  ListEntityLinksRoute,
  ListPendingLinksRoute,
  ListPlaylistsRoute,
  ListPlaylistTracksRoute,
  ListTracksRoute,
  RemoveArtistFromAlbumRoute,
  RemoveArtistFromTrackRoute,
  RemovePlaylistTrackRoute,
  ReorderPlaylistTracksRoute,
  ScrapeEntityLinksRoute,
  UpdateAlbumRoute,
  UpdateArtistRoute,
  UpdateEntityLinkStatusRoute,
  UpdatePlaylistRoute,
  UpdatePlaylistTrackRoute,
  UpdateTrackRoute
} from './music.routes'

// ---------------------------------------------------------------------------
// Artists
// ---------------------------------------------------------------------------

export const listArtists: AppRouteHandler<ListArtistsRoute> = async (c) => {
  const result = await AppRuntime.runPromise(
    Effect.gen(function* () {
      const svc = yield* MusicEntityService
      return yield* svc.getArtists()
    }).pipe(Effect.withSpan('api.music.listArtists'))
  )
  return c.json(result, HttpStatusCodes.OK)
}

export const createArtist: AppRouteHandler<CreateArtistRoute> = async (c) => {
  const body = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.createArtist(body)
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.createArtist')
  )
  const result = await AppRuntime.runPromise(program)
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.CREATED)
}

export const getArtist: AppRouteHandler<GetArtistRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getArtistById(id)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.withSpan('api.music.getArtist', { attributes: { id } })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  return c.json(result, HttpStatusCodes.OK)
}

export const updateArtist: AppRouteHandler<UpdateArtistRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.updateArtist(id, body)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.updateArtist', { attributes: { id } })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.OK)
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
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------

export const listAlbums: AppRouteHandler<ListAlbumsRoute> = async (c) => {
  const result = await AppRuntime.runPromise(
    Effect.gen(function* () {
      const svc = yield* MusicEntityService
      return yield* svc.getAlbums()
    }).pipe(Effect.withSpan('api.music.listAlbums'))
  )
  return c.json(result, HttpStatusCodes.OK)
}

export const createAlbum: AppRouteHandler<CreateAlbumRoute> = async (c) => {
  const body = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.createAlbum(body)
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.createAlbum')
  )
  const result = await AppRuntime.runPromise(program)
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.CREATED)
}

export const getAlbum: AppRouteHandler<GetAlbumRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getAlbumById(id)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.withSpan('api.music.getAlbum', { attributes: { id } })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  return c.json(result, HttpStatusCodes.OK)
}

export const updateAlbum: AppRouteHandler<UpdateAlbumRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.updateAlbum(id, body)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.updateAlbum', { attributes: { id } })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.OK)
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
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export const listTracks: AppRouteHandler<ListTracksRoute> = async (c) => {
  const result = await AppRuntime.runPromise(
    Effect.gen(function* () {
      const svc = yield* MusicEntityService
      return yield* svc.getTracks()
    }).pipe(Effect.withSpan('api.music.listTracks'))
  )
  return c.json(result, HttpStatusCodes.OK)
}

export const createTrack: AppRouteHandler<CreateTrackRoute> = async (c) => {
  const body = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.createTrack(body)
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.createTrack')
  )
  const result = await AppRuntime.runPromise(program)
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.CREATED)
}

export const getTrack: AppRouteHandler<GetTrackRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.getTrackById(id)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.withSpan('api.music.getTrack', { attributes: { id } })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  return c.json(result, HttpStatusCodes.OK)
}

export const updateTrack: AppRouteHandler<UpdateTrackRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.updateTrack(id, body)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.updateTrack', { attributes: { id } })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.OK)
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
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

export const listPlaylists: AppRouteHandler<ListPlaylistsRoute> = async (c) => {
  const result = await AppRuntime.runPromise(
    Effect.gen(function* () {
      const svc = yield* MusicEntityService
      return yield* svc.getPlaylists()
    }).pipe(Effect.withSpan('api.music.listPlaylists'))
  )
  return c.json(result, HttpStatusCodes.OK)
}

export const createPlaylist: AppRouteHandler<CreatePlaylistRoute> = async (
  c
) => {
  const body = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.createPlaylist(body)
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.createPlaylist')
  )
  const result = await AppRuntime.runPromise(program)
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.CREATED)
}

export const getPlaylist: AppRouteHandler<GetPlaylistRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    const playlist = yield* svc.getPlaylistById(id)
    const tracks = yield* svc.getPlaylistTracks(id)
    return { ...playlist, tracks }
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.withSpan('api.music.getPlaylist', { attributes: { id } })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  return c.json(result, HttpStatusCodes.OK)
}

export const updatePlaylist: AppRouteHandler<UpdatePlaylistRoute> = async (
  c
) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.updatePlaylist(id, body)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.updatePlaylist', { attributes: { id } })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.OK)
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
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Playlist tracks
// ---------------------------------------------------------------------------

export const listPlaylistTracks: AppRouteHandler<
  ListPlaylistTracksRoute
> = async (c) => {
  const { id } = c.req.valid('param')
  const result = await AppRuntime.runPromise(
    Effect.gen(function* () {
      const svc = yield* MusicEntityService
      return yield* svc.getPlaylistTracks(id)
    }).pipe(
      Effect.withSpan('api.music.listPlaylistTracks', { attributes: { id } })
    )
  )
  return c.json(result, HttpStatusCodes.OK)
}

export const addPlaylistTrack: AppRouteHandler<AddPlaylistTrackRoute> = async (
  c
) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    // Verify playlist exists first
    yield* svc.getPlaylistById(id)
    return yield* svc.addPlaylistTrack({ ...body, playlistId: id })
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.addPlaylistTrack', { attributes: { id } })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.CREATED)
}

export const updatePlaylistTrack: AppRouteHandler<
  UpdatePlaylistTrackRoute
> = async (c) => {
  const { trackId } = c.req.valid('param')
  const body = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.updatePlaylistTrack(trackId, body)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.updatePlaylistTrack', {
      attributes: { trackId }
    })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.OK)
}

export const removePlaylistTrack: AppRouteHandler<
  RemovePlaylistTrackRoute
> = async (c) => {
  const { trackId } = c.req.valid('param')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.removePlaylistTrack(trackId)
    return { ok: true } as const
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.withSpan('api.music.removePlaylistTrack', {
      attributes: { trackId }
    })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

export const reorderPlaylistTracks: AppRouteHandler<
  ReorderPlaylistTracksRoute
> = async (c) => {
  const { id } = c.req.valid('param')
  const { orderedIds } = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.reorderPlaylistTracks(id, orderedIds)
    return { ok: true } as const
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.reorderPlaylistTracks', { attributes: { id } })
  )
  const result = await AppRuntime.runPromise(program)
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export const listEntityLinks: AppRouteHandler<ListEntityLinksRoute> = async (
  c
) => {
  const { entityType, entityId } = c.req.valid('param')
  const { status } = c.req.valid('query')
  const result = await AppRuntime.runPromise(
    Effect.gen(function* () {
      const svc = yield* MusicEntityService
      return yield* svc.getLinksForEntity(entityType, entityId, status)
    }).pipe(
      Effect.withSpan('api.music.listEntityLinks', {
        attributes: { entityType, entityId }
      })
    )
  )
  return c.json(result, HttpStatusCodes.OK)
}

export const addEntityLink: AppRouteHandler<AddEntityLinkRoute> = async (c) => {
  const { entityType, entityId } = c.req.valid('param')
  const { platform, url } = c.req.valid('json')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    return yield* svc.addLink({ entityType, entityId, platform, url })
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.addEntityLink', {
      attributes: { entityType, entityId, platform }
    })
  )
  const result = await AppRuntime.runPromise(program)
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.CREATED)
}

export const updateEntityLinkStatus: AppRouteHandler<
  UpdateEntityLinkStatusRoute
> = async (c) => {
  const { entityType, entityId, linkId } = c.req.valid('param')
  const { status, metadata } = c.req.valid('json')
  const user = c.get('user')
  const userId = status === 'verified' ? user.id : undefined

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
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.updateEntityLinkStatus', {
      attributes: { entityType, entityId, linkId, status, userId }
    })
  )
  const result = await AppRuntime.runPromise(program)
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.OK)
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
  if ('notFound' in result) {
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  }
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
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.scrapeEntityLinks', {
      attributes: { entityType }
    })
  )
  const result = await AppRuntime.runPromise(program)
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.json(result, HttpStatusCodes.OK)
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
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.addArtistToAlbum', {
      attributes: { albumId, artistId }
    })
  )
  const result = await AppRuntime.runPromise(program)
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

export const removeArtistFromAlbum: AppRouteHandler<
  RemoveArtistFromAlbumRoute
> = async (c) => {
  const { albumId, artistId } = c.req.valid('param')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.removeArtistFromAlbum(albumId, artistId)
    return { ok: true } as const
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.removeArtistFromAlbum', {
      attributes: { albumId, artistId }
    })
  )
  const result = await AppRuntime.runPromise(program)
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
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
    return { ok: true } as const
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.addArtistToTrack', {
      attributes: { trackId, artistId }
    })
  )
  const result = await AppRuntime.runPromise(program)
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

export const removeArtistFromTrack: AppRouteHandler<
  RemoveArtistFromTrackRoute
> = async (c) => {
  const { trackId, artistId } = c.req.valid('param')
  const program = Effect.gen(function* () {
    const svc = yield* MusicEntityService
    yield* svc.removeArtistFromTrack(trackId, artistId)
    return { ok: true } as const
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message } as const)
    ),
    Effect.withSpan('api.music.removeArtistFromTrack', {
      attributes: { trackId, artistId }
    })
  )
  const result = await AppRuntime.runPromise(program)
  if ('error' in result) {
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export const listPendingLinks: AppRouteHandler<ListPendingLinksRoute> = async (
  c
) => {
  const { limit, offset } = c.req.valid('query')
  const result = await AppRuntime.runPromise(
    Effect.gen(function* () {
      const svc = yield* MusicEntityService
      return yield* svc.getPendingLinks({ limit, offset })
    }).pipe(Effect.withSpan('api.music.listPendingLinks'))
  )
  return c.json(result, HttpStatusCodes.OK)
}
