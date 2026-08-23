import { Schema } from 'effect'

const TrackSummarySchema = Schema.Struct({
  title: Schema.String,
  artists: Schema.String,
  previewUrl: Schema.optional(Schema.String),
  trackUrl: Schema.String
})

export const TrackSchema = Schema.Struct({
  albumType: Schema.optional(Schema.String),
  albumImageUrl: Schema.optional(Schema.String),
  title: Schema.String,
  artists: Schema.String,
  trackUrl: Schema.String,
  isrc: Schema.optional(Schema.String),
  previewUrl: Schema.optional(Schema.String)
})

export const AlbumSchema = Schema.Struct({
  albumType: Schema.String,
  albumImageUrl: Schema.optional(Schema.String),
  title: Schema.String,
  artists: Schema.String,
  tracks: Schema.Array(TrackSummarySchema),
  albumUrl: Schema.String
})

export const PlaylistSchema = Schema.Struct({
  coverImageUrl: Schema.optional(Schema.String),
  title: Schema.String,
  description: Schema.optional(Schema.String),
  tracks: Schema.Array(TrackSummarySchema),
  ownerName: Schema.optional(Schema.String),
  playlistUrl: Schema.String
})

export const AlbumSearchResultSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  artists: Schema.String,
  albumType: Schema.String,
  releaseDate: Schema.String,
  albumImageUrl: Schema.optional(Schema.String),
  albumUrl: Schema.String,
  totalTracks: Schema.Number
})

export const SearchAlbumsResponseSchema = Schema.Struct({
  albums: Schema.Array(AlbumSearchResultSchema),
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number
})

export type Track = typeof TrackSchema.Type
export type Album = typeof AlbumSchema.Type
export type Playlist = typeof PlaylistSchema.Type
export type AlbumSearchResult = typeof AlbumSearchResultSchema.Type
export type SearchAlbumsResponse = typeof SearchAlbumsResponseSchema.Type
