'use client'
import type React from 'react'
import { useSpotifyProxy } from '@/lib/http'
import { MultiTrack } from './MultiTrack'

interface Props {
  url: string
  genres?: string[]
  blurb?: string
  children?: React.ReactNode
}

export default function Playlist({ url, genres, blurb, children }: Props) {
  const encoded = encodeURIComponent(url)

  const { data, error } = useSpotifyProxy({
    id: encoded,
    spotifyContentType: 'playlist'
  })
  const loading = !data && !error

  return (
    <MultiTrack
      loading={loading}
      coverImageUrl={data?.coverImageUrl || ''}
      title={data?.title || ''}
      artists={data?.ownerName || ''}
      tracks={data?.tracks || []}
      genres={genres}
      blurb={blurb || ''}
      url={data?.playlistUrl || ''}>
      {children}
    </MultiTrack>
  )
}
