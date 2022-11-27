import React, { useState } from 'react'
import Track from './Track'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import fetcher from '@/lib/fetcher'
import useSWR from 'swr'
import { MinimalCard } from './common/MinimalCard'
import { playlist, track } from 'pages/api/playlist'
import { GB } from './common/icons'

interface Props {
  url: string
  genres?: string[]
  blurb?: string
  children?: React.ReactNode
}

export default function Playlist({ url, genres, blurb, children }: Props) {
  const [selectedTrack, setselectedTrack] = useState(null)

  const encoded = encodeURIComponent(url)

  const { data, error } = useSWR<playlist, Error>(`/api/playlist?id=${encoded}`, fetcher)
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
    <section className="p-3 rounded-md bg-cyan-900 md:p-7">
      <h2>{loading ? 'My Name is' : data.title}</h2>
      <div className="w-full grid-cols-3 gap-4 md:grid">
        <div className="col-span-1">
          {selectedTrack ? (
            // @ts-ignore
            <Track url={selectedTrack} />
          ) : (
            <MinimalCard
              imageUrl={data.coverImageUrl}
              title={data.title}
              slug={data.playlistUrl}
              previewUrl={data.tracks[0].previewUrl || null}
            />
          )}
        </div>
        <div className="col-span-2">
          <ScrollArea.Root className="w-full shadow-sm ScrollAreaRoot">
            <ScrollArea.Viewport className="h-full">
              <div style={{ padding: '15px 20px' }}>
                <h6 className="Text">Tracklist</h6>
                {data.tracks.map((track: track, index) => (
                  <div
                    className="hover:cursor-pointer Tag"
                    key={`${track.trackUrl} -  ${index}`}
                    onClick={() => setselectedTrack(track.trackUrl)}
                  >
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
            {data.description || ''}
            <br />
            {blurb || ''}
            <br />
            {children}
          </p>
        </div>
      </div>
    </section>
  )
}
