import { useAudioPlayerContext } from 'src/contexts/AudioPlayer'
import Image from 'next/image'
import React from 'react'
import { RxPause, RxPlay, RxResume } from 'react-icons/rx'

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
}) => {
  const [, { handleAlbumArtClick }, isPlaying, nowPlayingImageUrl] = useAudioPlayerContext()

  function renderIcon(isPlaying: boolean, imageUrl, nowPlayingImageUrl): React.ReactNode {
    if (nowPlayingImageUrl !== imageUrl) return <RxPlay className="w-20 h-20" />
    if (!isPlaying && nowPlayingImageUrl == imageUrl) return <RxResume className="w-20 h-20" />
    if (isPlaying && nowPlayingImageUrl == imageUrl) return <RxPause className="w-20 h-20" />
    return <RxPlay className="w-20 h-20" />
  }

  const DEFAULT_IMAGE =
    'https://res.cloudinary.com/hokaspokas/image/upload/v1663215495/goosebumpsfm/spotify_filler.svg'

  return (
    <div className="relative z-10 min-w-[320px] flex-shrink-0 max-w-md my-8 border-2 border-t-0 border-l-0 rounded-md border-gb-tomato ">
      <div className="relative flex-shrink-0 mb-4 sm:mb-0 sm:mr-4 group">
        <Image
          className={cn(
            'object-cover w-full rounded-md  aspect-square  mx-auto',
            loading ? 'scale-102 blur-2xl' : 'scale-100 blur-0'
          )}
          src={imageUrl || DEFAULT_IMAGE}
          alt={title}
          width={320}
          height={320}
          loading="lazy"
          quality={100}
        />
        <div
          title={`Click to play ${title}`}
          onClick={() => handleAlbumArtClick(previewUrl, imageUrl || DEFAULT_IMAGE)}
          className="absolute top-0 left-0 items-center justify-center hidden w-full h-full transition duration-700 ease-in-out rounded-md opacity-75 hover:cursor-pointer group-hover:flex bg-slate-500"
        >
          {renderIcon(isPlaying, imageUrl, nowPlayingImageUrl)}
        </div>
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
