import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import {
  addSpotifyTrackResultSchema,
  addSpotifyTrackToPlaylistSchema,
  entityTypeEnum,
  importSpotifyPlaylistResultSchema,
  importSpotifyPlaylistSchema,
  insertMusicAlbumSchema,
  insertMusicArtistSchema,
  insertMusicPlaylistSchema,
  insertMusicPlaylistTrackSchema,
  insertMusicTrackSchema,
  linkStatusEnum,
  musicPlatformEnum,
  reorderPlaylistTracksSchema,
  selectMusicAlbumSchema,
  selectMusicArtistSchema,
  selectMusicEntityLinkSchema,
  selectMusicPlaylistSchema,
  selectMusicTrackSchema,
  updateMusicAlbumSchema,
  updateMusicArtistSchema,
  updateMusicEntityLinkStatusSchema,
  updateMusicPlaylistSchema,
  updateMusicTrackSchema
} from '@/db/music-entity.schema'
import { requireAdminMiddleware } from '@/middlewares/better-auth.middleware'
import { strictRateLimiter } from '@/middlewares/rate-limiter'

const tags = ['Music']
const errorSchema = z.object({ error: z.string() })

// ---------------------------------------------------------------------------
// Artists
// ---------------------------------------------------------------------------

export const listArtists = createRoute({
  path: '/artists',
  method: 'get',
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectMusicArtistSchema),
      'List of artists'
    )
  }
})

export const createArtist = createRoute({
  path: '/artists',
  method: 'post',
  middleware: [requireAdminMiddleware],
  request: {
    body: jsonContentRequired(insertMusicArtistSchema, 'Artist data')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectMusicArtistSchema,
      'Created artist'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const getArtist = createRoute({
  path: '/artists/:id',
  method: 'get',
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectMusicArtistSchema, 'Artist'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found')
  }
})

export const updateArtist = createRoute({
  path: '/artists/:id',
  method: 'patch',
  middleware: [requireAdminMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonContentRequired(updateMusicArtistSchema, 'Fields to update')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMusicArtistSchema,
      'Updated artist'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const deleteArtist = createRoute({
  path: '/artists/:id',
  method: 'delete',
  middleware: [requireAdminMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Deleted' },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found')
  }
})

// ---------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------

export const listAlbums = createRoute({
  path: '/albums',
  method: 'get',
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectMusicAlbumSchema),
      'List of albums'
    )
  }
})

export const createAlbum = createRoute({
  path: '/albums',
  method: 'post',
  middleware: [requireAdminMiddleware],
  request: {
    body: jsonContentRequired(insertMusicAlbumSchema, 'Album data')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectMusicAlbumSchema,
      'Created album'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const getAlbum = createRoute({
  path: '/albums/:id',
  method: 'get',
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectMusicAlbumSchema, 'Album'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found')
  }
})

export const updateAlbum = createRoute({
  path: '/albums/:id',
  method: 'patch',
  middleware: [requireAdminMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonContentRequired(updateMusicAlbumSchema, 'Fields to update')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectMusicAlbumSchema, 'Updated album'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const deleteAlbum = createRoute({
  path: '/albums/:id',
  method: 'delete',
  middleware: [requireAdminMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Deleted' },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found')
  }
})

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export const listTracks = createRoute({
  path: '/tracks',
  method: 'get',
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectMusicTrackSchema),
      'List of tracks'
    )
  }
})

export const createTrack = createRoute({
  path: '/tracks',
  method: 'post',
  middleware: [requireAdminMiddleware],
  request: {
    body: jsonContentRequired(insertMusicTrackSchema, 'Track data')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectMusicTrackSchema,
      'Created track'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const getTrack = createRoute({
  path: '/tracks/:id',
  method: 'get',
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectMusicTrackSchema, 'Track'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found')
  }
})

export const updateTrack = createRoute({
  path: '/tracks/:id',
  method: 'patch',
  middleware: [requireAdminMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonContentRequired(updateMusicTrackSchema, 'Fields to update')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectMusicTrackSchema, 'Updated track'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const deleteTrack = createRoute({
  path: '/tracks/:id',
  method: 'delete',
  middleware: [requireAdminMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Deleted' },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found')
  }
})

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

export const listPlaylists = createRoute({
  path: '/playlists',
  method: 'get',
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectMusicPlaylistSchema),
      'List of playlists'
    )
  }
})

export const createPlaylist = createRoute({
  path: '/playlists',
  method: 'post',
  middleware: [requireAdminMiddleware],
  request: {
    body: jsonContentRequired(insertMusicPlaylistSchema, 'Playlist data')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectMusicPlaylistSchema,
      'Created playlist'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const getPlaylist = createRoute({
  path: '/playlists/:id',
  method: 'get',
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectMusicPlaylistSchema, 'Playlist'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found')
  }
})

export const updatePlaylist = createRoute({
  path: '/playlists/:id',
  method: 'patch',
  middleware: [requireAdminMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonContentRequired(updateMusicPlaylistSchema, 'Fields to update')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMusicPlaylistSchema,
      'Updated playlist'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const deletePlaylist = createRoute({
  path: '/playlists/:id',
  method: 'delete',
  middleware: [requireAdminMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Deleted' },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found')
  }
})

// ---------------------------------------------------------------------------
// Playlist tracks
// ---------------------------------------------------------------------------

const playlistTrackResponseSchema = z
  .object({
    track: selectMusicTrackSchema,
    position: z.number().int(),
    addedAt: z.date(),
    links: z.array(selectMusicEntityLinkSchema)
  })
  .openapi('PlaylistTrackEntry')

export const getPlaylistTracks = createRoute({
  path: '/playlists/:id/tracks',
  method: 'get',
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(playlistTrackResponseSchema),
      'Tracks in playlist (ordered)'
    )
  }
})

export const addTrackToPlaylist = createRoute({
  path: '/playlists/:id/tracks',
  method: 'post',
  middleware: [requireAdminMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonContentRequired(insertMusicPlaylistTrackSchema, 'Track to add')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        playlistId: z.string().uuid(),
        trackId: z.string().uuid(),
        position: z.number().int(),
        addedAt: z.date()
      }),
      'Added'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const removeTrackFromPlaylist = createRoute({
  path: '/playlists/:id/tracks/:trackId',
  method: 'delete',
  middleware: [requireAdminMiddleware],
  request: {
    params: z.object({
      id: z.string().uuid(),
      trackId: z.string().uuid()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Removed' }
  }
})

export const reorderPlaylistTracks = createRoute({
  path: '/playlists/:id/tracks/order',
  method: 'put',
  middleware: [requireAdminMiddleware],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonContentRequired(
      reorderPlaylistTracksSchema,
      'New ordering of trackIds'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Reordered' },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      errorSchema,
      'Mismatched track set'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const addSpotifyTrackToPlaylist = createRoute({
  path: '/playlists/:id/tracks/spotify',
  method: 'post',
  middleware: [requireAdminMiddleware, strictRateLimiter()],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonContentRequired(
      addSpotifyTrackToPlaylistSchema,
      'Spotify track URL'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      addSpotifyTrackResultSchema,
      'Added'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Invalid URL'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const importSpotifyPlaylist = createRoute({
  path: '/playlists/import/spotify',
  method: 'post',
  middleware: [requireAdminMiddleware, strictRateLimiter()],
  request: {
    body: jsonContentRequired(
      importSpotifyPlaylistSchema,
      'Spotify playlist URL'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      importSpotifyPlaylistResultSchema,
      'Imported playlist'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Invalid URL'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Import failed'
    )
  }
})

// ---------------------------------------------------------------------------
// Resolve a pasted URL into a music entity
// ---------------------------------------------------------------------------

export const resolveMusicEntity = createRoute({
  path: '/resolve',
  method: 'post',
  middleware: [requireAdminMiddleware, strictRateLimiter()],
  request: {
    body: jsonContentRequired(
      z.object({
        url: z.string().url().openapi({
          description:
            'Any supported music URL (Spotify, Apple Music, Bandcamp, YouTube)'
        })
      }),
      'URL to resolve'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        entityType: entityTypeEnum,
        entity: z.record(z.string(), z.unknown()),
        links: z.array(selectMusicEntityLinkSchema),
        coverImageUrl: z.string().nullable()
      }),
      'Resolved music entity'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

// ---------------------------------------------------------------------------
// Links — per entity
// ---------------------------------------------------------------------------

const entityParams = z.object({
  entityType: entityTypeEnum,
  entityId: z.string().uuid()
})

export const listEntityLinks = createRoute({
  path: '/:entityType/:entityId/links',
  method: 'get',
  request: {
    params: entityParams,
    query: z.object({
      status: linkStatusEnum.optional()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectMusicEntityLinkSchema),
      'Links for this entity'
    )
  }
})

export const addEntityLink = createRoute({
  path: '/:entityType/:entityId/links',
  method: 'post',
  middleware: [requireAdminMiddleware],
  request: {
    params: entityParams,
    body: jsonContentRequired(
      z.object({
        platform: musicPlatformEnum,
        url: z.string().url()
      }),
      'Link to add'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectMusicEntityLinkSchema,
      'Added link'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const updateEntityLinkStatus = createRoute({
  path: '/:entityType/:entityId/links/:linkId',
  method: 'patch',
  middleware: [requireAdminMiddleware],
  request: {
    params: entityParams.extend({ linkId: z.string().uuid() }),
    body: jsonContentRequired(
      updateMusicEntityLinkStatusSchema,
      'Status update'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMusicEntityLinkSchema,
      'Updated link'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const deleteEntityLink = createRoute({
  path: '/:entityType/:entityId/links/:linkId',
  method: 'delete',
  middleware: [requireAdminMiddleware],
  request: {
    params: entityParams.extend({ linkId: z.string().uuid() })
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Deleted' },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Not found')
  }
})

// ---------------------------------------------------------------------------
// Scrape — trigger link discovery for an entity
// ---------------------------------------------------------------------------

export const scrapeEntityLinks = createRoute({
  path: '/:entityType/scrape',
  method: 'post',
  middleware: [requireAdminMiddleware, strictRateLimiter()],
  request: {
    params: z.object({ entityType: entityTypeEnum }),
    body: jsonContentRequired(
      z.object({
        url: z
          .string()
          .url()
          .optional()
          .openapi({
            description:
              'Any streaming URL (Spotify, Bandcamp, YouTube, etc.). ' +
              'Odesli expands it to 15+ platform links.',
            example: 'https://open.spotify.com/album/5J3O2A5oPaWDxePgJdSgNJ'
          }),
        artistName: z.string().optional(),
        albumTitle: z.string().optional(),
        trackTitle: z.string().optional(),
        mbid: z
          .string()
          .optional()
          .openapi({ description: 'MusicBrainz ID for direct lookup' }),
        isrc: z
          .string()
          .optional()
          .openapi({ description: 'International Standard Recording Code' })
      }),
      'Scrape input — provide at least one field'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        entity: z.record(z.string(), z.unknown()).openapi({
          description:
            'The auto-created entity (artist, album, track, or playlist)'
        }),
        links: z.array(selectMusicEntityLinkSchema)
      }),
      'Entity created and links scraped'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

// ---------------------------------------------------------------------------
// Review queue — all pending links (admin)
// ---------------------------------------------------------------------------

export const listPendingLinks = createRoute({
  path: '/links/pending',
  method: 'get',
  middleware: [requireAdminMiddleware],
  request: {
    query: z.object({
      limit: z.coerce.number().min(1).max(100).optional().default(50),
      offset: z.coerce.number().min(0).optional().default(0)
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectMusicEntityLinkSchema),
      'Pending links awaiting review'
    )
  }
})

// ---------------------------------------------------------------------------
// Artist ↔ album / track junction endpoints
// ---------------------------------------------------------------------------

const albumArtistParams = z.object({
  albumId: z.string().uuid(),
  artistId: z.string().uuid()
})

const trackArtistParams = z.object({
  trackId: z.string().uuid(),
  artistId: z.string().uuid()
})

const artistJunctionBody = z.object({
  role: z.string().optional().openapi({ example: 'featured' }),
  displayOrder: z.number().int().optional()
})

export const addArtistToAlbum = createRoute({
  path: '/albums/:albumId/artists/:artistId',
  method: 'put',
  middleware: [requireAdminMiddleware],
  request: {
    params: albumArtistParams,
    body: jsonContentRequired(artistJunctionBody, 'Artist role on this album')
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Artist added/updated' },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const removeArtistFromAlbum = createRoute({
  path: '/albums/:albumId/artists/:artistId',
  method: 'delete',
  middleware: [requireAdminMiddleware],
  request: { params: albumArtistParams },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Artist removed' },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const addArtistToTrack = createRoute({
  path: '/tracks/:trackId/artists/:artistId',
  method: 'put',
  middleware: [requireAdminMiddleware],
  request: {
    params: trackArtistParams,
    body: jsonContentRequired(artistJunctionBody, 'Artist role on this track')
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Artist added/updated' },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

export const removeArtistFromTrack = createRoute({
  path: '/tracks/:trackId/artists/:artistId',
  method: 'delete',
  middleware: [requireAdminMiddleware],
  request: { params: trackArtistParams },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: 'Artist removed' },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema,
      'Server error'
    )
  }
})

// ---------------------------------------------------------------------------
// Route type exports
// ---------------------------------------------------------------------------

export type ListArtistsRoute = typeof listArtists
export type CreateArtistRoute = typeof createArtist
export type GetArtistRoute = typeof getArtist
export type UpdateArtistRoute = typeof updateArtist
export type DeleteArtistRoute = typeof deleteArtist

export type ListAlbumsRoute = typeof listAlbums
export type CreateAlbumRoute = typeof createAlbum
export type GetAlbumRoute = typeof getAlbum
export type UpdateAlbumRoute = typeof updateAlbum
export type DeleteAlbumRoute = typeof deleteAlbum

export type ListTracksRoute = typeof listTracks
export type CreateTrackRoute = typeof createTrack
export type GetTrackRoute = typeof getTrack
export type UpdateTrackRoute = typeof updateTrack
export type DeleteTrackRoute = typeof deleteTrack

export type ListPlaylistsRoute = typeof listPlaylists
export type CreatePlaylistRoute = typeof createPlaylist
export type GetPlaylistRoute = typeof getPlaylist
export type UpdatePlaylistRoute = typeof updatePlaylist
export type DeletePlaylistRoute = typeof deletePlaylist
export type GetPlaylistTracksRoute = typeof getPlaylistTracks
export type AddTrackToPlaylistRoute = typeof addTrackToPlaylist
export type RemoveTrackFromPlaylistRoute = typeof removeTrackFromPlaylist
export type ImportSpotifyPlaylistRoute = typeof importSpotifyPlaylist
export type ReorderPlaylistTracksRoute = typeof reorderPlaylistTracks
export type AddSpotifyTrackToPlaylistRoute = typeof addSpotifyTrackToPlaylist

export type ResolveMusicEntityRoute = typeof resolveMusicEntity

export type ListEntityLinksRoute = typeof listEntityLinks
export type AddEntityLinkRoute = typeof addEntityLink
export type UpdateEntityLinkStatusRoute = typeof updateEntityLinkStatus
export type DeleteEntityLinkRoute = typeof deleteEntityLink
export type ScrapeEntityLinksRoute = typeof scrapeEntityLinks
export type ListPendingLinksRoute = typeof listPendingLinks

export type AddArtistToAlbumRoute = typeof addArtistToAlbum
export type RemoveArtistFromAlbumRoute = typeof removeArtistFromAlbum
export type AddArtistToTrackRoute = typeof addArtistToTrack
export type RemoveArtistFromTrackRoute = typeof removeArtistFromTrack
