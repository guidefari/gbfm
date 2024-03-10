import React from 'react'

export type NowPlayingSong = {
  album: string
  albumImageUrl: string
  artist: string
  isPlaying: boolean
  songUrl: string
  title: string
  // context: url, also check what the spotify context object is shaped like
}

export type Tweet = {
  authorName: string
  handle: string
  avatarUrl: string
  date: string
  children: React.ReactNode
}

export type TrackAPIResponse = {
  albumType?: string
  albumImageUrl?: string
  title?: string
  artists?: string
  trackUrl?: string
  previewUrl?: string
}

export type Track = Omit<TrackAPIResponse, 'albumType'>

export type GenericAndMaybeLegacyError = {
  error: string
}

export interface PlaylistApiResponse {
  coverImageUrl: string
  title: string
  description: string
  tracks: TrackAPIResponse[]
  ownerName: string
  playlistUrl: string
}

export type AlbumSingleTrackApiResponse = Omit<TrackAPIResponse, 'album_type' | 'albumImageUrl'>

export type AlbumApiResponse = {
  albumType?: string
  albumImageUrl?: string
  title?: string
  artists?: string
  previewUrl?: string
  tracks: AlbumSingleTrackApiResponse[]
  albumUrl: string
}

export type PlaylistInput = {
  refresh_token: string
  user_id: string
  offset?: number
  next_url?: string
}

type ExternalUrls = {
  spotify: string
}

type Image = {
  height: number | null
  url: string
  width: number | null
}

type Owner = {
  display_name: string
  external_urls: ExternalUrls
  href: string
  id: string
  type: string
  uri: string
}

type Tracks = {
  href: string
  total: number
}

type PlaylistItem = {
  collaborative: boolean
  description: string
  external_urls: ExternalUrls
  href: string
  id: string
  images: Image[]
  name: string
  owner: Owner
  primary_color: string | null
  public: boolean
  snapshot_id: string
  tracks: Tracks
  type: string
  uri: string
}

export type PlaylistResponse = {
  href: string
  items: PlaylistItem[]
  limit: number
  next: string | null
  offset: number
  previous: string | null
  total: number
}
