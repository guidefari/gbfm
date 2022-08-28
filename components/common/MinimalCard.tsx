import Image from 'next/future/image'
import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'
import { PauseIcon, PlayIcon } from './icons'

interface Props {
  title: string
  blurb: string
  imageUrl: string
  slug?: string
  genres?: string[]
  loading?: boolean
  previewUrl?: string
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

  // useEffect(() => {
  //   if (previewUrl) {
  //     audioRef.current.src = previewUrl
  //   }
  // }, [previewUrl])

  return (
    <div className="flex-shrink-0 my-5 group sm:flex lg:items-start">
      <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
        <span className="relative">
          <Image
            className={cn(
              'duration-700 object-cover sm:max-w-xs rounded-md clickable-artwork aspect-square ease-in-out group-hover:opacity-75 hover:cursor-pointer',
              loading ? 'scale-110 blur-2xl' : 'scale-100 blur-0'
            )}
            src={
              imageUrl ||
              'https://res.cloudinary.com/hokaspokas/image/upload/v1657259208/here-hugo/fmfm_hyskxj.svg'
            }
            alt={title}
            width={320}
            height={320}
            onClick={handleAudioPreview}
          />
          {playPreview ? (
            <button
              title="Pause Preview Audio"
              className="absolute top-0 left-0 p-3 m-4 bg-white rounded-full"
              onClick={handleAudioPreview}
            >
              <PauseIcon />
            </button>
          ) : (
            <button
              className="absolute top-0 left-0 p-3 m-4 bg-white rounded-full"
              onClick={handleAudioPreview}
            >
              <PlayIcon />
            </button>
          )}
        </span>
      </div>
      <div>
        {genres &&
          genres.map((genre, index) => (
            <span key={index} className="p-1 px-2 mr-2 text-sm rounded-full bg-cyan-800">
              {genre}
            </span>
          ))}
        <p className="mt-3 text-lg font-medium leading-6">
          <a
            target="_blank"
            href={(slug as string) || ''}
            className="text-xl text-indigo-900 hover:transition-all hover:underline"
          >
            {title || ''}
          </a>
        </p>
        <p className="mt-2 leading-normal text-blue-100 text">{blurb || ''}</p>
        <audio src={previewUrl || ''} ref={audioRef}></audio>
      </div>
    </div>
  )
}
