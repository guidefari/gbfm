import Link from 'next/link'
import React from 'react'

interface Props {
  title: string
  blurb: string
  imageUrl: string
  slug?: string
}

export const MinimalCard: React.FC<Props> = ({ title, blurb, imageUrl, slug }) => {
  return (
    <div className="group flex-shrink-0 sm:flex lg:items-start">
      <div className="mb-4 flex-shrink-0 sm:mb-0 sm:mr-4">
        <Link href={slug as string}>
          <img
            className="aspect-square max-w-xs rounded-md object-cover"
            src={imageUrl}
            alt={title}
          />
        </Link>
      </div>
      <div>
        <span className="text-sm ">Genres</span>
        <p className="mt-3 text-lg font-medium leading-6">
          <Link href={slug as string} className="text-xl text-indigo-900 hover:text-indigo-700">
            {title || ''}
          </Link>
        </p>
        <p className="text mt-2 leading-normal text-blue-100">{blurb || ''}</p>
      </div>
    </div>
  )
}
