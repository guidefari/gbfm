import fetcher from 'src/lib/fetcher'
import { AlbumApiResponse, AlbumSingleTrackApiResponse } from 'src/lib/types'
import React from 'react'
import useSWR from 'swr'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { GB } from './common/icons'
import { MinimalCard } from './common/MinimalCard'
import { PlayPauseButton } from './PlayPauseButton'

interface Props {
  url: string
  genres?: string[]
  blurb?: string
  children?: React.ReactNode
}

export default function Album({ url, genres, blurb, children }: Props) {
  const encoded = encodeURIComponent(url)

  const { data, error } = useSWR<AlbumApiResponse, Error>(`/api/album?id=${encoded}`, fetcher)

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
    <section className="p-3 pb-0 my-5 border-2 rounded-md min-w-fit border-gb-tomato md:p-7 md:pb-0">
      <div className="w-full grid-cols-3 gap-4 md:grid">
        <div className="col-span-1">
          <MinimalCard
            imageUrl={data?.albumImageUrl || ''}
            title={data?.title || ''}
            slug={data?.albumUrl || ''}
            artists={data?.artists || ''}
          />
        </div>
        <div className="col-span-2 pb-10 ">
          <ScrollArea.Root className="w-full shadow-sm h-80 lg:h-96 ScrollAreaRoot">
            <ScrollArea.Viewport className="h-full bg-gb-bg">
              <ul className="p-0">
                {data?.tracks.map((track: AlbumSingleTrackApiResponse, index) => (
                  <li className="m-0 list-none" key={`${track.trackUrl} - ${index}`}>
                    <div className="flex items-center p-0 space-x-1 text-white group hover:cursor-pointer Tag hover:text-green-300">
                      {data.previewUrl?.length > 0 && (
                        <button
                          className="opacity-50 text-sky-300 group-hover:text-gb-tomato group-hover:opacity-95"
                          type="button"
                          title="Play/Pause"
                        >
                          <PlayPauseButton
                            url={track.previewUrl}
                            thumbnailUrl={data.albumImageUrl}
                          />
                        </button>
                      )}
                      {track.title} - {track.artists}
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar className="ScrollAreaScrollbar" orientation="vertical">
              <ScrollArea.Thumb className="ScrollAreaThumb" />
            </ScrollArea.Scrollbar>
            <ScrollArea.Scrollbar className="ScrollAreaScrollbar" orientation="horizontal">
              <ScrollArea.Thumb className="ScrollAreaThumb" />
            </ScrollArea.Scrollbar>
            <ScrollArea.Corner className="ScrollAreaCorner" />
          </ScrollArea.Root>
          {genres && genres[0] !== '' && (
            <p className="flex flex-wrap mt-6">
              {genres.map((genre, index) => (
                <span key={index} className="p-1 px-2 m-1 mr-2 text-sm rounded-full bg-cyan-800">
                  {genre}
                </span>
              ))}
            </p>
          )}
          {(blurb || children) && (
            <div className="mt-6 text-sm leading-snug ">{blurb || children}</div>
          )}
        </div>
      </div>
    </section>
  )
}
