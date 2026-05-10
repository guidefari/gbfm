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
  // Playlist tracks
  .openapi(routes.importSpotifyPlaylist, handlers.importSpotifyPlaylist)
  .openapi(routes.syncPlaylistLinks, handlers.syncPlaylistLinks)
  .openapi(routes.reorderPlaylistTracks, handlers.reorderPlaylistTracks)
  .openapi(routes.addSpotifyTrackToPlaylist, handlers.addSpotifyTrackToPlaylist)
  .openapi(routes.getPlaylistTracks, handlers.getPlaylistTracks)
  .openapi(routes.addTrackToPlaylist, handlers.addTrackToPlaylist)
  .openapi(routes.removeTrackFromPlaylist, handlers.removeTrackFromPlaylist)
  .openapi(routes.resolveMusicEntity, handlers.resolveMusicEntity)
  // Review queue (before polymorphic /:entityType routes to avoid conflict)
  .openapi(routes.listPendingLinks, handlers.listPendingLinks)
  // Links per entity
  .openapi(routes.listEntityLinks, handlers.listEntityLinks)
  .openapi(routes.addEntityLink, handlers.addEntityLink)
  .openapi(routes.updateEntityLinkStatus, handlers.updateEntityLinkStatus)
  .openapi(routes.deleteEntityLink, handlers.deleteEntityLink)
  // Scraping
  .openapi(routes.scrapeEntityLinks, handlers.scrapeEntityLinks)
  // Artist ↔ album / track junctions
  .openapi(routes.addArtistToAlbum, handlers.addArtistToAlbum)
  .openapi(routes.removeArtistFromAlbum, handlers.removeArtistFromAlbum)
  .openapi(routes.addArtistToTrack, handlers.addArtistToTrack)
  .openapi(routes.removeArtistFromTrack, handlers.removeArtistFromTrack)

export default router
