import fetcher from '@/lib/fetcher'
import { AlbumApiResponse, AlbumSingleTrackApiResponse } from '@/lib/types'
import React, { useState } from 'react'
import useSWR from 'swr'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import Image from 'next/image'
import { GB } from './common/icons'
import { MinimalCard } from './common/MinimalCard'
import Track from './Track'

interface Props {
  url: string
  genres?: string[]
  blurb?: string
  children?: React.ReactNode
}

export default function Album({ url, genres, blurb, children }: Props) {
  const [selectedTrack, setselectedTrack] = useState(null)
  const encoded = encodeURIComponent(url)

  const { data, error } = useSWR<AlbumApiResponse>(`/api/album?id=${encoded}`, fetcher)

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
      <div className="w-full grid-cols-3 gap-4 md:grid">
        <div className="col-span-1">
          {selectedTrack ? (
            <Track url={selectedTrack} />
          ) : (
            <MinimalCard
              imageUrl={data?.albumImageUrl || ''}
              title={data?.title || ''}
              slug={data?.albumUrl || ''}
              previewUrl={data.tracks[0].previewUrl || null}
              spotify
            />
          )}
        </div>
        <div className="col-span-2 pb-10 ">
          <ScrollArea.Root className="w-full shadow-sm h-96 ScrollAreaRoot">
            <ScrollArea.Viewport className="h-full ">
              <div className="bg-transparent">
                <div className="sticky top-0 py-1 bg-gb-bg">
                  <h6 className="mx-2 underline max-w-none">Album: {data.title}</h6>
                </div>
                {data.tracks.map((track: AlbumSingleTrackApiResponse, index) => (
                  <div
                    className="mx-2 text-white hover:cursor-pointer Tag hover:text-green-300"
                    key={`${track.trackUrl} -  ${index}`}
                    onClick={() => setselectedTrack(track.trackUrl)}
                  >
                    <Image
                      className="inline mr-1 rounded-sm"
                      alt={track.title}
                      src={data.albumImageUrl}
                      width={32}
                      height={32}
                      loading="lazy"
                    />
                    {track.title} - {track.artists}
                  </div>
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
          {genres && (
            <p className="flex flex-wrap mt-6">
              {genres.map((genre, index) => (
                <span key={index} className="p-1 px-2 m-1 mr-2 text-sm rounded-full bg-cyan-800">
                  {genre}
                </span>
              ))}
            </p>
          )}
          {(blurb || children) && <p className="mt-6 text-sm leading-snug ">{blurb || children}</p>}
        </div>
      </div>
    </section>
  )
}
