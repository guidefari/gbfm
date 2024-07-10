import { Track } from '@/src/types'
import { GB } from './common/icons'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { PlayPauseButton } from './PlayPauseButton'
import Image from 'next/image'
import { cn } from '@/lib/util'
import { DEFAULT_IMAGE_URL } from '../constants'
import Link from 'next/link'
import clsx from 'clsx'

type Props = {
  loading: boolean
  coverImageUrl: string
  title: string
  artists: string
  tracks: Track[]
  genres?: string[]
  blurb?: string
  children?: React.ReactNode
  url: string
}

export function MultiTrack({
  loading,
  coverImageUrl,
  title,
  artists,
  tracks,
  genres,
  blurb,
  children,
  url,
}: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center w-full rounded-md h-80 bg-cyan-900 opacity-60 animate-pulse">
        <span className="animate-spin-slow">
          <GB />
        </span>
      </div>
    )
  }

  return (
    <section className="p-3 my-5 border-2 rounded-lg not-prose min-w-fit border-gb-pastel-green-2 md:px-7 ">
      <Link href={url}>
        <h5 className="my-2">
          {artists} - {title}
        </h5>
      </Link>
      <div className="w-full grid-cols-3 gap-4 md:grid">
        <div className="col-span-1 mb-3 md:mb-0">
          <Image
            className={cn(
              'object-cover max-w-44 md:max-w-full mt-1 mb-0 rounded-md  aspect-square  mx-auto',
              loading ? 'scale-102 blur-2xl' : 'scale-100 blur-0'
            )}
            src={coverImageUrl || DEFAULT_IMAGE_URL}
            alt={title}
            width={300}
            height={300}
            loading="lazy"
            quality={100}
          />

          {genres && genres[0] !== '' && (
            <div className="flex flex-wrap mt-6">
              {genres.map((genre, index) => (
                <span key={index} className="p-1 px-2 m-1 mr-2 text-sm rounded-full bg-gb-darker-bg">
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="col-span-2">
          <ScrollArea.Root className="w-full shadow-sm h-80 ScrollAreaRoot">
            <ScrollArea.Viewport className="h-full bg-gb-bg">
              <ul className="p-0">
                {tracks.map((track, index) => (
                  <li className="" key={`${track.trackUrl} - ${index}`}>
                    <div
                      className={clsx(
                        'flex items-center  mb-2 space-x-1 text-white group Tag'
                        // track.previewUrl?.length > 0 && ' hover:cursor-pointer'
                      )}
                    >
                      {track.previewUrl?.length && (
                        <button
                          className={clsx(
                            'opacity-50 text-sky-300 hover:text-gb-tomato hover:opacity-95 hover:cursor-pointer',
                            'mr-2'
                          )}
                          type="button"
                          title="Play/Pause"
                        >
                          <PlayPauseButton
                            url={track.previewUrl}
                            thumbnailUrl={track.albumImageUrl}
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
        </div>
      </div>
      {(blurb || children) && <div className="mt-6 text-sm leading-snug ">{blurb || children}</div>}
    </section>
  )
}
