'use client'
import type React from 'react'
import { useSpotifyProxy } from '@/lib/http'
import { MinimalCard } from './common/MinimalCard'

interface Props {
  url: string
  genres?: string[]
  blurb?: string
  children?: React.ReactNode
}

export default function Track({ url, genres, blurb, children }: Props) {
  const encoded = encodeURIComponent(url)

  const { data, isLoading } = useSpotifyProxy({
    id: encoded,
    spotifyContentType: 'track'
  })

  return (
    <div>
      <MinimalCard
        key={url}
        loading={isLoading}
        blurb={blurb || ''}
        imageUrl={data?.albumImageUrl || ''}
        title={data?.title || ''}
        artists={data?.artists || ''}
        genres={genres || null}
        previewUrl={data?.previewUrl}
        trackUrl={data?.trackUrl}>
        {children}
      </MinimalCard>
    </div>
  )
}

export { Track }
