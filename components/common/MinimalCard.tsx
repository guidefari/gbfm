import Image from 'next/future/image'
import Link from 'next/link'
import React from 'react'

interface Props {
  title: string
  blurb: string
  imageUrl: string
  slug?: string
  genres?: string[]
}

export const MinimalCard: React.FC<Props> = ({ title, blurb, imageUrl, slug, genres }) => {
  return (
    <div className="my-5 flex-shrink-0 group sm:flex lg:items-start">
      <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
        <a className='clickable-artwork' target='_blank' href={slug}>
          <Image
            className="clickable-artwork object-cover max-w-xs rounded-md aspect-square"
            src={imageUrl}
            alt={title}
            width={320}
            height={320}
          />
        </a>
      </div>
      <div>
        {genres && genres.map((genre, index) => (<span key={index} className="text-sm mr-2">{genre}</span>))}
        <p className="mt-3 text-lg font-medium leading-6">
          <a target='_blank' href={slug as string} className="text-xl hover:transition-all text-indigo-900 hover:underline">
            {title || ''}
          </a>
        </p>
        <p className="mt-2 leading-normal text-blue-100 text">{blurb || ''}</p>
      </div>
    </div>
  )
}
