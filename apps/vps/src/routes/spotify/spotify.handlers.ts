import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { AppRuntime } from '@/runtime'
import { SpotifyService } from '@/services/spotify.service'
import type {
  EnrichTrackFromUrlRoute,
  GetAlbumRoute,
  GetPlaylistRoute,
  GetTrackRoute,
  SearchAlbumsRoute
} from './spotify.routes'

export const getTrack: AppRouteHandler<GetTrackRoute> = async (c) => {
  const { id } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const spotifyService = yield* SpotifyService
    const track = yield* spotifyService.getTrack(id)
    return track
  }).pipe(
    Effect.catchTag('SpotifyError', (e) =>
      Effect.succeed({
        error: e.message,
        status:
          e.statusCode === 400
            ? HttpStatusCodes.NOT_FOUND
            : HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

export const getAlbum: AppRouteHandler<GetAlbumRoute> = async (c) => {
  const { id } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const spotifyService = yield* SpotifyService
    const album = yield* spotifyService.getAlbum(id)
    return album
  }).pipe(
    Effect.catchTag('SpotifyError', (e) =>
      Effect.succeed({
        error: e.message,
        status:
          e.statusCode === 400
            ? HttpStatusCodes.NOT_FOUND
            : HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

export const getPlaylist: AppRouteHandler<GetPlaylistRoute> = async (c) => {
  const { id } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const spotifyService = yield* SpotifyService
    const playlist = yield* spotifyService.getPlaylist(id)
    return playlist
  }).pipe(
    Effect.catchTag('SpotifyError', (e) =>
      Effect.succeed({
        error: e.message,
        status:
          e.statusCode === 400
            ? HttpStatusCodes.NOT_FOUND
            : HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

export const searchAlbums: AppRouteHandler<SearchAlbumsRoute> = async (c) => {
  const { query, limit = 10, offset = 0 } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const spotifyService = yield* SpotifyService
    const searchResult = yield* spotifyService.searchAlbums(
      query,
      limit,
      offset
    )
    return searchResult
  }).pipe(
    Effect.catchTag('SpotifyError', (e) =>
      Effect.succeed({
        error: e.message,
        status:
          e.statusCode === 400
            ? HttpStatusCodes.BAD_REQUEST
            : HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

export const enrichTrackFromUrl: AppRouteHandler<
  EnrichTrackFromUrlRoute
> = async (c) => {
  const { url } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const spotifyService = yield* SpotifyService
    const enrichedTrack = yield* spotifyService.enrichTrackFromUrl(url)
    return enrichedTrack
  }).pipe(
    Effect.catchTag('SpotifyError', (e) =>
      Effect.succeed({
        error: e.message,
        status:
          e.statusCode === 400
            ? HttpStatusCodes.BAD_REQUEST
            : e.statusCode === 404
              ? HttpStatusCodes.NOT_FOUND
              : HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}
