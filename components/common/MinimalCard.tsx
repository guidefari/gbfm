import Image from 'next/future/image'
import Link from 'next/link'
import React from 'react'

interface Props {
  title: string
  blurb: string
  imageUrl: string
  slug?: string
  genres?: string[]
  loading?: boolean
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export const MinimalCard: React.FC<Props> = ({ title, blurb, imageUrl, slug, genres, loading }) => {
  return (
    <div className="flex-shrink-0 my-5 group sm:flex lg:items-start">
      <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
        <a className="clickable-artwork" target="_blank" href={slug || ''}>
          <Image
            className={cn(
              'duration-700 object-cover max-w-xs rounded-md clickable-artwork aspect-square ease-in-out group-hover:opacity-75',
              loading ? 'scale-110 blur-2xl' : 'scale-100 blur-0'
            )}
            src={
              imageUrl ||
              'https://res.cloudinary.com/hokaspokas/image/upload/v1657259208/here-hugo/fmfm_hyskxj.svg'
            }
            alt={title}
            width={320}
            height={320}
          />
        </a>
      </div>
      <div>
        {genres &&
          genres.map((genre, index) => (
            <span key={index} className="mr-2 text-sm">
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
      </div>
    </div>
  )
}
