import { useAudioPlayerContext } from 'contexts/AudioPlayer'
import Image from 'next/future/image'
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
    <div className="relative flex-shrink-0 max-w-md p-3 my-5 rounded-md bg-cyan-900 ">
      <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
        <Image
          className={cn(
            'duration-700 object-cover w-full  rounded-md clickable-artwork aspect-square ease-in-out hover:cursor-pointer mx-auto',
            loading ? 'scale-110 blur-2xl' : 'scale-100 blur-0'
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
        />
      </div>
      <div>
        <p className="flex flex-wrap">
          {genres &&
            genres.map((genre, index) => (
              <span key={index} className="p-1 px-2 m-1 mr-2 text-sm rounded-full bg-cyan-800">
                {genre}
              </span>
            ))}
        </p>
        <p className="mt-3 text-lg font-medium leading-6">
          Title:{' '}
          <CustomLink
            target="_blank"
            href={(slug as string) || ''}
            as={(slug as string) || ''}
            className="mb-0 text-xl leading-tight text-indigo-900 hover:transition-all hover:underline"
            rel="noreferrer"
          >
            {title || ''}
          </CustomLink>
        </p>
        <p className="mt-2 text">By: {artists || ''}</p>
        <p className="mt-2 text-sm leading-snug ">{blurb || ''}</p>
        {children}
      </div>
    </div>
  )
}
