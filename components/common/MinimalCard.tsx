import Image from 'next/future/image'
import React, { useRef, useState } from 'react'
import CustomLink from '../CustomLink'
import { PauseIcon, PlayIcon } from './icons'

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
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playPreview, setPlayPreview] = useState(false)

  function handleAudioPreview() {
    if (previewUrl && audioRef.current) {
      if (!playPreview) {
        setPlayPreview(true)
        audioRef.current.play()
      } else {
        setPlayPreview(false)
        audioRef.current.pause()
      }
    }
  }

  return (
    <div className="relative flex-shrink-0 max-w-md p-3 my-5 rounded-md bg-cyan-900 ">
      <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
        {previewUrl &&
          (playPreview ? (
            <button
              title="Pause Preview Audio"
              className="absolute top-0 left-0 z-10 p-3 m-5 bg-teal-900 rounded-full text-highlight"
              onClick={handleAudioPreview}
            >
              <PauseIcon />
            </button>
          ) : (
            <button
              className="absolute top-0 left-0 z-10 p-3 m-5 bg-teal-900 rounded-full text-highlight"
              onClick={handleAudioPreview}
            >
              <PlayIcon />
            </button>
          ))}
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
          onClick={handleAudioPreview}
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
        <audio src={previewUrl || ''} ref={audioRef}></audio>
        {children}
      </div>
    </div>
  )
}
