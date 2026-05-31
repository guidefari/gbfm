import { Effect } from 'effect'
import { runEffect } from '@/lib/effect-hono'
import type { AppRouteHandler } from '@/lib/types'
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
    return yield* spotifyService.getTrack(id)
  }).pipe(Effect.withSpan('api.spotify.getTrack', { attributes: { id } }))

  return runEffect<GetTrackRoute>(c, program)
}

export const getAlbum: AppRouteHandler<GetAlbumRoute> = async (c) => {
  const { id } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const spotifyService = yield* SpotifyService
    return yield* spotifyService.getAlbum(id)
  }).pipe(Effect.withSpan('api.spotify.getAlbum', { attributes: { id } }))

  return runEffect<GetAlbumRoute>(c, program)
}

export const getPlaylist: AppRouteHandler<GetPlaylistRoute> = async (c) => {
  const { id } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const spotifyService = yield* SpotifyService
    return yield* spotifyService.getPlaylist(id)
  }).pipe(Effect.withSpan('api.spotify.getPlaylist', { attributes: { id } }))

  return runEffect<GetPlaylistRoute>(c, program)
}

export const searchAlbums: AppRouteHandler<SearchAlbumsRoute> = async (c) => {
  const { query, limit = 10, offset = 0 } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const spotifyService = yield* SpotifyService
    return yield* spotifyService.searchAlbums(query, limit, offset)
  }).pipe(Effect.withSpan('api.spotify.searchAlbums', { attributes: { query } }))

  return runEffect<SearchAlbumsRoute>(c, program)
}

export const enrichTrackFromUrl: AppRouteHandler<EnrichTrackFromUrlRoute> = async (c) => {
  const { url } = c.req.valid('json')

  const program = Effect.gen(function* () {
    const spotifyService = yield* SpotifyService
    return yield* spotifyService.enrichTrackFromUrl(url)
  }).pipe(Effect.withSpan('api.spotify.enrichTrackFromUrl', { attributes: { url } }))

  return runEffect<EnrichTrackFromUrlRoute>(c, program)
}
