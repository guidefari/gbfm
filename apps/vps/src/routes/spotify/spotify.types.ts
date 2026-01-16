import { z } from '@hono/zod-openapi'

export const TrackSchema = z
  .object({
    albumType: z
      .string()
      .optional()
      .openapi({ description: 'Type of album this track belongs to' }),
    albumImageUrl: z
      .string()
      .optional()
      .openapi({ description: 'Album cover image URL' }),
    title: z.string().openapi({ description: 'Track title' }),
    artists: z.string().openapi({ description: 'Track artists' }),
    trackUrl: z.string().openapi({ description: 'Spotify track URL' }),
    previewUrl: z
      .string()
      .optional()
      .openapi({ description: '30-second preview URL' })
  })
  .openapi('SpotifyTrack')

export const AlbumSchema = z
  .object({
    albumType: z
      .string()
      .openapi({ description: 'Type of album', example: 'album' }),
    albumImageUrl: z
      .string()
      .optional()
      .openapi({ description: 'Album cover image URL' }),
    title: z.string().openapi({ description: 'Album title' }),
    artists: z.string().openapi({ description: 'Album artists' }),
    tracks: z
      .array(
        z
          .object({
            title: z.string().openapi({ description: 'Track title' }),
            artists: z.string().openapi({ description: 'Track artists' }),
            previewUrl: z
              .string()
              .optional()
              .openapi({ description: '30-second preview URL' }),
            trackUrl: z.string().openapi({ description: 'Spotify track URL' })
          })
          .openapi('SpotifyTrack')
      )
      .openapi({ description: 'Album tracks' }),
    albumUrl: z.string().openapi({ description: 'Spotify album URL' })
  })
  .openapi('SpotifyAlbum')

export const PlaylistSchema = z
  .object({
    coverImageUrl: z
      .string()
      .optional()
      .openapi({ description: 'Playlist cover image URL' }),
    title: z.string().openapi({ description: 'Playlist title' }),
    description: z
      .string()
      .optional()
      .openapi({ description: 'Playlist description' }),
    tracks: z
      .array(
        z
          .object({
            title: z.string().openapi({ description: 'Track title' }),
            artists: z.string().openapi({ description: 'Track artists' }),
            previewUrl: z
              .string()
              .optional()
              .openapi({ description: '30-second preview URL' }),
            trackUrl: z.string().openapi({ description: 'Spotify track URL' })
          })
          .openapi('SpotifyTrack')
      )
      .openapi({ description: 'Playlist tracks' }),
    ownerName: z
      .string()
      .optional()
      .openapi({ description: 'Playlist owner name' }),
    playlistUrl: z.string().openapi({ description: 'Spotify playlist URL' })
  })
  .openapi('SpotifyPlaylist')

export const AlbumSearchResultSchema = z
  .object({
    id: z.string().openapi({ description: 'Spotify album ID' }),
    title: z.string().openapi({ description: 'Album title' }),
    artists: z.string().openapi({ description: 'Album artists' }),
    albumType: z
      .string()
      .openapi({ description: 'Type of album', example: 'album' }),
    releaseDate: z.string().openapi({ description: 'Release date' }),
    albumImageUrl: z
      .string()
      .optional()
      .openapi({ description: 'Album cover image URL' }),
    albumUrl: z.string().openapi({ description: 'Spotify album URL' }),
    totalTracks: z
      .number()
      .openapi({ description: 'Total number of tracks in album' })
  })
  .openapi('SpotifyAlbumSearchResult')

export const SearchAlbumsResponseSchema = z
  .object({
    albums: z
      .array(AlbumSearchResultSchema)
      .openapi({ description: 'Array of album search results' }),
    total: z
      .number()
      .openapi({ description: 'Total number of results available' }),
    limit: z.number().openapi({ description: 'Number of results per page' }),
    offset: z.number().openapi({ description: 'Number of results to skip' })
  })
  .openapi('SpotifyAlbumSearchResponse')

export type Track = z.infer<typeof TrackSchema>
export type Album = z.infer<typeof AlbumSchema>
export type Playlist = z.infer<typeof PlaylistSchema>
export type AlbumSearchResult = z.infer<typeof AlbumSearchResultSchema>
export type SearchAlbumsResponse = z.infer<typeof SearchAlbumsResponseSchema>
