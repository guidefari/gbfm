import React, { useState } from 'react'
import Track from './Track'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import fetcher from '@/lib/fetcher'
import useSWR from 'swr'

interface Props {
  url: string
  genres?: string[]
  blurb?: string
  children?: React.ReactNode
}

export const Playlist = ({ url, genres, blurb, children }: Props) => {
  // const [selectedTrack, setselectedTrack] = useState()
  const TAGS = Array.from({ length: 50 }).map((_, i, a) => `v1.2.0-beta.${a.length - i}`)

  const encoded = encodeURIComponent(url)

  const { data, error } = useSWR(`/api/playlist?id=${encoded}`, fetcher)
  const loading = !data && !error

  return (
    <section className="p-3 rounded-md bg-cyan-900 md:p-7">
      <h2>Playlist.name</h2>
      <div className="w-full grid-cols-3 gap-4 md:grid">
        <div className="col-span-1">
          {/* @ts-ignore */}
          <Track
            url={'https://open.spotify.com/track/0mSuk14kKUiC3Q6qj0u49o?si=fb91d9cc789c45ee'}
          />
        </div>
        <div className="col-span-2">
          <ScrollArea.Root className="w-full shadow-sm ScrollAreaRoot">
            <ScrollArea.Viewport className="h-full">
              <div style={{ padding: '15px 20px' }}>
                <h6 className="Text">Tracklist</h6>
                {TAGS.map((tag) => (
                  <div className="Tag" key={tag}>
                    {tag}
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
          <p className="flex flex-wrap">
            {genres &&
              genres.map((genre, index) => (
                <span key={index} className="p-1 px-2 m-1 mr-2 text-sm rounded-full bg-cyan-800">
                  {genre}
                </span>
              ))}
          </p>
          <hr className="mx-10 my-4 border-b-2 rounded-full border-gb-pastel-green-2" />
          <p className="mt-2 text-sm leading-snug ">
            {blurb || ''}
            {children}
          </p>
        </div>
      </div>
    </section>
  )
}
