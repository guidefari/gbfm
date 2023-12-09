import { useAudioPlayerContext } from 'src/contexts/AudioPlayer'
import Image from 'next/image'
import React from 'react'
import { FaDownload } from 'react-icons/fa'
import { DEFAULT_IMAGE_URL } from '@/src/constants'
import { PlayPauseButton } from '../PlayPauseButton'
import { cn } from '@/lib/util'

// this component needs to support:
// stream link to spotify
// stream link to bandcamp
// mp3 download link for self hosted mp3

interface Props {
  title: string
  artists?: string
  blurb?: string
  imageUrl: string
  genres?: string[] | null
  loading?: boolean
  previewUrl?: string
  children?: React.ReactNode
  download?: boolean
  className?: string
}

export const MinimalCard: React.FC<Props> = ({
  title,
  blurb,
  imageUrl,
  genres,
  loading,
  previewUrl,
  children,
  artists,
  download = false,
  className,
}) => {
  const [audioRef, { handleAlbumArtClick }, isPlaying] = useAudioPlayerContext()

  const constructUrl = () => {
    const safeTitle = encodeURIComponent(title)
    const safeDlUrl = encodeURIComponent(previewUrl)
    return `/api/dl?fileUrl=${safeDlUrl}&title=${safeTitle}`
  }

  return (
    <div
      className={`not-prose relative z-10 flex-shrink-0 max-w-md my-8 border-2 border-t-0 border-l-0 rounded-md md:max-w-xs border-gb-tomato ${className}`}
    >
      <div className="relative flex-shrink-0 mb-4 sm:mb-0 sm:mr-4 group">
        <Image
          className={cn(
            'object-cover w-full rounded-md  aspect-square  mx-auto',
            loading ? 'scale-102 blur-2xl' : 'scale-100 blur-0'
          )}
          src={imageUrl || DEFAULT_IMAGE_URL}
          alt={title}
          width={300}
          height={300}
          loading="lazy"
          quality={100}
        />
      </div>
      <div className="p-3">
        {genres && genres.length > 0 && (
          <p className="flex flex-wrap space-x-2">
            {genres.map((genre, index) => (
              <span key={index} className="p-1 px-2 text-sm rounded-full bg-cyan-800">
                {genre}
              </span>
            ))}
          </p>
        )}

        {previewUrl?.length > 0 && (
          <div className="flex my-2 space-x-3 align-bottom ">
            <PlayPauseButton url={previewUrl} thumbnailUrl={imageUrl} />
            {download && (
              <a type="button" title="Download" href={constructUrl()}>
                <FaDownload className="default-icon h-[16px]" />
              </a>
            )}
          </div>
        )}

        <p className="mt-3 text-sm font-medium leading-6">
          {artists ?? null}
          {' - '}
          {title ?? null}
        </p>
        {(blurb || children) && (
          <hr className="mx-10 my-4 border-b-2 rounded-full border-gb-pastel-green-2" />
        )}
        <div className="mt-2 ">{children || blurb || <br />}</div>
      </div>
    </div>
  )
}
