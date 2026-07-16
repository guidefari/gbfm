import { z } from 'zod'

export const TrackSchema = z.object({
  albumType: z.string().optional(),
  albumImageUrl: z.string().optional(),
  title: z.string(),
  artists: z.string(),
  trackUrl: z.string(),
  previewUrl: z.string().optional()
})

export const AlbumSchema = z.object({
  albumType: z.string(),
  albumImageUrl: z.string().optional(),
  title: z.string(),
  artists: z.string(),
  tracks: z.array(
    z.object({
      title: z.string(),
      artists: z.string(),
      previewUrl: z.string().optional(),
      trackUrl: z.string()
    })
  ),
  albumUrl: z.string()
})

export const PlaylistSchema = z.object({
  coverImageUrl: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  tracks: z.array(
    z.object({
      title: z.string(),
      artists: z.string(),
      previewUrl: z.string().optional(),
      trackUrl: z.string()
    })
  ),
  ownerName: z.string().optional(),
  playlistUrl: z.string()
})

export const AlbumSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  artists: z.string(),
  albumType: z.string(),
  releaseDate: z.string(),
  albumImageUrl: z.string().optional(),
  albumUrl: z.string(),
  totalTracks: z.number()
})

export const SearchAlbumsResponseSchema = z.object({
  albums: z.array(AlbumSearchResultSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number()
})

export type Track = z.infer<typeof TrackSchema>
export type Album = z.infer<typeof AlbumSchema>
export type Playlist = z.infer<typeof PlaylistSchema>
export type AlbumSearchResult = z.infer<typeof AlbumSearchResultSchema>
export type SearchAlbumsResponse = z.infer<typeof SearchAlbumsResponseSchema>
