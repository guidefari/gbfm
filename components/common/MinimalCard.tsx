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
  spotify?: boolean
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
  spotify = false,
}) => {
  const [_, { handleAlbumArtClick }] = useAudioPlayerContext()

  return (
    <div className="relative z-10 flex-shrink-0 max-w-md mx-auto my-8 rounded-md ">
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
            className="mb-0 text-xl leading-tight text-green-500 hover:transition-all hover:underline"
            rel="noreferrer"
            title={`Stream ${title} on Spotify` || ''}
          >
            {spotify && title && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 32"
                className="inline-block w-6 h-6 mr-2 fill-current hover:underline"
              >
                <path d="M16 0c-8.803 0-16 7.197-16 16s7.197 16 16 16c8.803 0 16-7.197 16-16s-7.12-16-16-16zM23.36 23.12c-0.319 0.479-0.881 0.64-1.36 0.317-3.76-2.317-8.479-2.797-14.083-1.52-0.557 0.165-1.037-0.235-1.199-0.72-0.156-0.557 0.24-1.036 0.719-1.197 6.084-1.36 11.365-0.803 15.521 1.76 0.563 0.24 0.64 0.88 0.401 1.36zM25.281 18.719c-0.401 0.563-1.12 0.803-1.683 0.401-4.317-2.641-10.88-3.437-15.916-1.839-0.641 0.156-1.365-0.161-1.521-0.803-0.161-0.64 0.156-1.359 0.797-1.52 5.844-1.761 13.041-0.876 18 2.161 0.484 0.24 0.724 1.041 0.323 1.599zM25.443 14.24c-5.125-3.043-13.683-3.36-18.563-1.839-0.801 0.239-1.599-0.24-1.839-0.964-0.239-0.797 0.24-1.599 0.959-1.839 5.683-1.681 15.041-1.359 20.964 2.161 0.719 0.401 0.957 1.36 0.557 2.079-0.401 0.563-1.36 0.801-2.079 0.401z" />
              </svg>
            )}
            {title || <br />}
          </CustomLink>
        </p>
        <p className="mt-2 text" title={`Arist(s): ${artists}`}>
          {artists || <br />}
        </p>
        {(blurb || children) && (
          <hr className="mx-10 my-4 border-b-2 rounded-full border-gb-pastel-green-2" />
        )}
        <p className="mt-2 text-sm leading-snug ">{blurb || <br />}</p>
        {children}
      </div>
    </div>
  )
}
