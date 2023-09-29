import React, { useState } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import fetcher from 'src/lib/fetcher'
import useSWR from 'swr'
import Image from 'next/image'
import { PlaylistApiResponse, TrackAPIResponse } from 'src/lib/types'
import { MinimalCard } from './common/MinimalCard'
import { GB } from './common/icons'
import Track from './Track'

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

  if (loading)
    return (
      <div className="flex items-center justify-center w-full rounded-md h-80 bg-cyan-900 opacity-60 animate-pulse">
        <span className="animate-spin-slow">
          <GB />
        </span>
      </div>
    )

  return (
    <section className="p-3 pb-0 my-5 border-2 rounded-md border-gb-tomato md:p-7 md:pb-0">
      <div className="w-full grid-cols-3 gap-4 lg:grid">
        <div className="col-span-2">
          <ScrollArea.Root className="w-full shadow-sm h-72 lg:h-96 ScrollAreaRoot">
            <ScrollArea.Viewport className="h-full ">
              <div className="bg-transparent">
                <div className="sticky top-0 py-1 bg-gb-bg">
                  <h6 className="mx-2 underline max-w-none">Playlist: {data?.title}</h6>
                </div>
                {data?.tracks.map((track: TrackAPIResponse, index) => (
                  <button
                    type="button"
                    className="mx-2 text-white hover:cursor-pointer Tag hover:text-green-300"
                    key={`${track.trackUrl} -  ${index}`}
                    // onClick={() => setselectedTrack(track.trackUrl)}
                  >
                    <Image
                      className="inline mr-1 rounded-sm"
                      alt={track.title}
                      src={track.albumImageUrl}
                      width={32}
                      height={32}
                      loading="lazy"
                    />
                    {track.title} - {track.artists}
                  </button>
                ))}
              </div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar className="ScrollAreaScrollbar" orientation="vertical">
              <ScrollArea.Thumb className="ScrollAreaThumb" />
            </ScrollArea.Scrollbar>
            <ScrollArea.Scrollbar className="ScrollAreaScrollbar" orientation="horizontal">
              <ScrollArea.Thumb className="ScrollAreaThumb" />
            </ScrollArea.Scrollbar>
            <ScrollArea.Corner className="ScrollAreaCorner" />
          </ScrollArea.Root>
          {genres &&
            genres[0] !== '' &&
            genres.map((genre, index) => (
              <p key={index} className="flex flex-wrap mt-6">
                <span className="p-1 px-2 m-1 mr-2 text-sm rounded-full bg-cyan-800">{genre}</span>
              </p>
            ))}
          {(blurb || children) && (
            <div className="mt-6 text-sm leading-snug ">{blurb || children}</div>
          )}
        </div>
      </div>
    </section>
  )
}
