import React from 'react'

export type NowPlayingSong = {
  album: string
  albumImageUrl: string
  artist: string
  isPlaying: boolean
  songUrl: string
  title: string
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

export type AlbumSingleTrackApiResponse = TrackAPIResponse<Omit, 'album_type' | 'albumImageUrl'>

export type AlbumApiResponse = {
  albumType?: string
  albumImageUrl?: string
  title?: string
  artists?: string
  trackUrl?: string
  previewUrl?: string
  tracks: AlbumSingleTrackApiResponse[]
  albumUrl: string
}
