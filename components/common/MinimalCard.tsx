import Image from 'next/future/image'
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
    <div className="flex-shrink-0 group sm:flex lg:items-start">
      <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
        <Link href={slug as string}>
          <Image
            className="object-cover max-w-xs rounded-md aspect-square"
            src={imageUrl}
            alt={title}
            width={320}
            height={320}
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
        <p className="mt-2 leading-normal text-blue-100 text">{blurb || ''}</p>
      </div>
    </div>
  )
}
