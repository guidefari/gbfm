import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import {
  entityTypeEnum,
  insertMusicAlbumSchema,
  insertMusicArtistSchema,
  insertMusicEntityLinkSchema,
  insertMusicPlaylistSchema,
  insertMusicTrackSchema,
  linkStatusEnum,
  musicPlatformEnum,
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
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonContentRequired(updateMusicArtistSchema, 'Fields to update')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectMusicArtistSchema, 'Updated artist'),
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
  path: '/:entityType/:entityId/scrape',
  method: 'post',
  request: {
    params: entityParams,
    body: jsonContentRequired(
      z.object({
        seedUrl: z
          .string()
          .url()
          .openapi({
            description:
              'Any streaming URL for this entity (Spotify, Bandcamp, etc.). ' +
              'Odesli will expand it to all known platform links.',
            example: 'https://open.spotify.com/album/5J3O2A5oPaWDxePgJdSgNJ'
          })
      }),
      'Seed URL for scraping'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        scraped: z.number().openapi({ description: 'Number of links found' }),
        links: z.array(selectMusicEntityLinkSchema)
      }),
      'Scrape results — links are stored with status pending_review'
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

export type ListEntityLinksRoute = typeof listEntityLinks
export type AddEntityLinkRoute = typeof addEntityLink
export type UpdateEntityLinkStatusRoute = typeof updateEntityLinkStatus
export type DeleteEntityLinkRoute = typeof deleteEntityLink
export type ScrapeEntityLinksRoute = typeof scrapeEntityLinks
export type ListPendingLinksRoute = typeof listPendingLinks
