import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import {
  AlbumSchema,
  PlaylistSchema,
  SearchAlbumsResponseSchema,
  TrackSchema
} from './spotify.types'

const tags = ['Spotify']

export const getTrack = createRoute({
  path: '/track',
  method: 'post',
  request: {
    body: jsonContentRequired(z.object({ id: z.string() }), 'Spotify track ID or URL')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(TrackSchema, 'Track details'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ error: z.string() }), 'Track not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch track'
    )
  }
})

export const getAlbum = createRoute({
  path: '/album',
  method: 'post',
  request: {
    body: jsonContentRequired(z.object({ id: z.string() }), 'Spotify album ID or URL')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(AlbumSchema, 'Album details'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ error: z.string() }), 'Album not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch album'
    )
  }
})

export const getPlaylist = createRoute({
  path: '/playlist',
  method: 'post',
  request: {
    body: jsonContentRequired(z.object({ id: z.string() }), 'Spotify playlist ID or URL')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(PlaylistSchema, 'Playlist details'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ error: z.string() }), 'Playlist not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch playlist'
    )
  }
})

export const searchAlbums = createRoute({
  path: '/search/albums',
  method: 'post',
  request: {
    body: jsonContentRequired(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).optional().default(10),
        offset: z.number().min(0).optional().default(0)
      }),
      'Album search query'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(SearchAlbumsResponseSchema, 'Search results'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid search query'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to search albums'
    )
  }
})

export const enrichTrackFromUrl = createRoute({
  path: '/enrich',
  method: 'post',
  request: {
    body: jsonContentRequired(
      z.object({
        url: z.string().url('Must be a valid URL')
      }),
      'URL to enrich track details from'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        title: z.string(),
        artist: z.string(),
        url: z.string(),
        platform: z.enum(['spotify', 'youtube', 'apple_music', 'bandcamp', 'other']),
        thumbnailUrl: z.string().optional(),
        duration: z.number().optional(),
        album: z.string().optional()
      }),
      'Enriched track details'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid URL or unsupported platform'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ error: z.string() }), 'Track not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to enrich track details'
    )
  }
})

export type GetTrackRoute = typeof getTrack
export type GetAlbumRoute = typeof getAlbum
export type GetPlaylistRoute = typeof getPlaylist
export type SearchAlbumsRoute = typeof searchAlbums
export type EnrichTrackFromUrlRoute = typeof enrichTrackFromUrl
