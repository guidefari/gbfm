import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { TrackSchema, AlbumSchema, PlaylistSchema } from './spotify.types'

const tags = ['Spotify']

export const getTrack = createRoute({
  path: '/track',
  method: 'post',
  request: {
    body: jsonContentRequired(
      z.object({ id: z.string() }),
      'Spotify track ID or URL'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(TrackSchema, 'Track details'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Track not found'
    ),
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
    body: jsonContentRequired(
      z.object({ id: z.string() }),
      'Spotify album ID or URL'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(AlbumSchema, 'Album details'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Album not found'
    ),
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
    body: jsonContentRequired(
      z.object({ id: z.string() }),
      'Spotify playlist ID or URL'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(PlaylistSchema, 'Playlist details'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Playlist not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch playlist'
    )
  }
})

export type GetTrackRoute = typeof getTrack
export type GetAlbumRoute = typeof getAlbum
export type GetPlaylistRoute = typeof getPlaylist
