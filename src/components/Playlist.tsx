import React, { useState } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import fetcher from 'src/lib/fetcher'
import useSWR from 'swr'
import Image from 'next/image'
import { PlaylistApiResponse, TrackAPIResponse } from 'src/lib/types'
import { MinimalCard } from './common/MinimalCard'
import { GB } from './common/icons'
import Track from './Track'
import { MultiTrack } from './MultiTrack'

interface Props {
  url: string
  genres?: string[]
  blurb?: string
  children?: React.ReactNode
}

export default function Playlist({ url, genres, blurb, children }: Props) {
  const encoded = encodeURIComponent(url)

  const { data, error } = useSWR<PlaylistApiResponse, Error>(`/api/playlist?id=${encoded}`, fetcher)
  const loading = !data && !error

  return (
    <MultiTrack
      loading={loading}
      coverImageUrl={data?.coverImageUrl || ''}
      title={data?.title || ''}
      artists={data?.ownerName || ''}
      tracks={data?.tracks || []}
      genres={genres || null}
      blurb={blurb || ''}
    >
      {children}
    </MultiTrack>
  )
}
