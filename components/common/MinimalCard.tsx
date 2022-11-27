import { useAudioPlayerContext } from 'contexts/AudioPlayer'
import Image from 'next/image'
import React from 'react'
import CustomLink from '../CustomLink'

interface Props {
  title: string
  artists?: string
  blurb?: string
  imageUrl: string
  slug?: string
  genres?: string[]
  loading?: boolean
  previewUrl?: string
  children?: React.ReactNode
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export const MinimalCard: React.FC<Props> = ({
  title,
  blurb,
  imageUrl,
  slug,
  genres,
  loading,
  previewUrl,
  children,
  artists,
}) => {
  const [_, { handleAlbumArtClick }] = useAudioPlayerContext()

  return (
    <div className="relative z-10 flex-shrink-0 max-w-md rounded-md bg-cyan-900 ">
      <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
        <Image
          className={cn(
            'duration-700 object-cover w-full  rounded-md clickable-artwork aspect-square ease-in-out hover:cursor-pointer mx-auto',
            loading ? 'scale-102 blur-2xl' : 'scale-100 blur-0'
          )}
          src={
            imageUrl ||
            'https://res.cloudinary.com/hokaspokas/image/upload/v1663215495/goosebumpsfm/spotify_filler.svg'
          }
          alt={title}
          width={320}
          height={320}
          onClick={() => handleAlbumArtClick(previewUrl)}
          loading="lazy"
          title={`Click to play audio preview of ${title}`}
        />
      </div>
      <div className="p-3">
        <p className="flex flex-wrap space-x-2">
          {genres &&
            genres.map((genre, index) => (
              <span key={index} className="p-1 px-2 text-sm rounded-full bg-cyan-800">
                {genre}
              </span>
            ))}
        </p>
        <p className="mt-3 text-lg font-medium leading-6">
          <CustomLink
            target="_blank"
            href={(slug as string) || ''}
            as={(slug as string) || ''}
            className="mb-0 text-xl leading-tight hover:transition-all hover:underline"
            rel="noreferrer"
            title={`Stream ${title} on Spotify` || ''}
          >
            {title || <br />}
          </CustomLink>
        </p>
        <p className="mt-2 text" title={`Arist(s): ${artists}`}>
          {artists || <br />}
        </p>
        <hr className="mx-10 my-4 border-b-2 rounded-full border-gb-pastel-green-2" />
        <p className="mt-2 text-sm leading-snug ">{blurb || <br />}</p>
        {children}
      </div>
    </div>
  )
}
