import { createRouter } from '@/lib/create-app'

import * as handlers from './music.handlers'
import * as routes from './music.routes'

const router = createRouter()
  // Artists
  .openapi(routes.listArtists, handlers.listArtists)
  .openapi(routes.createArtist, handlers.createArtist)
  .openapi(routes.getArtist, handlers.getArtist)
  .openapi(routes.updateArtist, handlers.updateArtist)
  .openapi(routes.deleteArtist, handlers.deleteArtist)
  // Albums
  .openapi(routes.listAlbums, handlers.listAlbums)
  .openapi(routes.createAlbum, handlers.createAlbum)
  .openapi(routes.getAlbum, handlers.getAlbum)
  .openapi(routes.updateAlbum, handlers.updateAlbum)
  .openapi(routes.deleteAlbum, handlers.deleteAlbum)
  // Tracks
  .openapi(routes.listTracks, handlers.listTracks)
  .openapi(routes.createTrack, handlers.createTrack)
  .openapi(routes.getTrack, handlers.getTrack)
  .openapi(routes.updateTrack, handlers.updateTrack)
  .openapi(routes.deleteTrack, handlers.deleteTrack)
  // Playlists
  .openapi(routes.listPlaylists, handlers.listPlaylists)
  .openapi(routes.createPlaylist, handlers.createPlaylist)
  .openapi(routes.getPlaylist, handlers.getPlaylist)
  .openapi(routes.updatePlaylist, handlers.updatePlaylist)
  .openapi(routes.deletePlaylist, handlers.deletePlaylist)
  // Review queue (before polymorphic /:entityType routes to avoid conflict)
  .openapi(routes.listPendingLinks, handlers.listPendingLinks)
  // Links per entity
  .openapi(routes.listEntityLinks, handlers.listEntityLinks)
  .openapi(routes.addEntityLink, handlers.addEntityLink)
  .openapi(routes.updateEntityLinkStatus, handlers.updateEntityLinkStatus)
  .openapi(routes.deleteEntityLink, handlers.deleteEntityLink)
  // Scraping
  .openapi(routes.scrapeEntityLinks, handlers.scrapeEntityLinks)

export default router
