import { useAudioPlayerContext } from 'src/contexts/AudioPlayer'
import Image from 'next/image'
import React from 'react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { FaDownload } from 'react-icons/fa'

// this component needs to support:
// stream link to spotify
// stream link to bandcamp
// mp3 download link for self hosted mp3

interface Props {
  title: string
  artists?: string
  blurb?: string
  imageUrl: string
  slug?: string
  genres?: string[] | null
  loading?: boolean
  previewUrl?: string
  children?: React.ReactNode
  spotify?: boolean
  download?: boolean
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
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
}) => {
  const [audioRef, { handleAlbumArtClick }, isPlaying] = useAudioPlayerContext()

  const iconClassNames = 'min-w-[19px] aspect-square text-sky-300 hover:text-gb-tomato'
  function renderIcon(isPlaying: boolean): React.ReactNode {
    if (previewUrl !== audioRef?.src) return <GiPlayButton className={iconClassNames} />
    if (!isPlaying && previewUrl == audioRef?.src)
      return <GiPlayButton className={iconClassNames} />
    if (isPlaying && previewUrl == audioRef?.src)
      return <GiPauseButton className={iconClassNames} />
    return <GiPlayButton className={iconClassNames} />
  }

  const DEFAULT_IMAGE =
    'https://res.cloudinary.com/hokaspokas/image/upload/v1663215495/goosebumpsfm/spotify_filler.svg'

  const constructUrl = () => {
    const safeTitle = encodeURIComponent(title)
    const safeDlUrl = encodeURIComponent(previewUrl)
    return `/api/dl?fileUrl=${safeDlUrl}&title=${safeTitle}`
  }

  return (
    <div className="relative z-10 flex-shrink-0 max-w-md my-8 border-2 border-t-0 border-l-0 rounded-md md:max-w-xs border-gb-tomato ">
      <div className="relative flex-shrink-0 mb-4 sm:mb-0 sm:mr-4 group">
        <Image
          className={cn(
            'object-cover w-full rounded-md  aspect-square  mx-auto',
            loading ? 'scale-102 blur-2xl' : 'scale-100 blur-0'
          )}
          src={imageUrl || DEFAULT_IMAGE}
          alt={title}
          width={300}
          height={300}
          loading="lazy"
          quality={100}
        />
      </div>
      <div className="p-3">
        {genres && (
          <p className="flex flex-wrap space-x-2">
            {genres.map((genre, index) => (
              <span key={index} className="p-1 px-2 text-sm rounded-full bg-cyan-800">
                {genre}
              </span>
            ))}
          </p>
        )}
        <p className="mt-3 text-lg font-medium leading-6">{title || <br />}</p>

        <div className="flex my-2 space-x-3 align-bottom ">
          <button
            type="button"
            title="Play/Pause"
            onClick={() => handleAlbumArtClick(previewUrl, imageUrl || DEFAULT_IMAGE)}
          >
            {renderIcon(isPlaying)}
          </button>
          {download && (
            <a type="button" title="Download" href={constructUrl()}>
              <FaDownload className={`${iconClassNames} h-[16px]`} />
            </a>
          )}
        </div>

        {artists && (
          <p className="mt-2 " title={`Arist(s): ${artists}`}>
            {artists || <br />}
          </p>
        )}
        {(blurb || children) && (
          <hr className="mx-10 my-4 border-b-2 rounded-full border-gb-pastel-green-2" />
        )}
        <div className="mt-2 ">{children || blurb || <br />}</div>
      </div>
    </div>
  )
}
