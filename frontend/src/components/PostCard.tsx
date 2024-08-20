import Image from 'next/image'
import React from 'react'
import { DEFAULT_IMAGE_URL } from '../constants'
import CustomLink from './CustomLink'

interface Props {
  date?: string
  title: string
  description?: string
  thumbnailUrl?: string
  slug: string
}

export const PostCard: React.FC<Props> = ({ date, title, description, thumbnailUrl, slug }) => (
  <div className="grid px-1 pb-4 border-2 border-t-0 border-l-0 rounded-md shadow-lg sm:grid-flow-col sm:grid-cols-5 border-gb-tomato">
    <CustomLink href={slug} as={slug} className="my-auto text-xl group sm:mr-3 sm:col-span-2">
      <Image
        className="object-cover w-32 transition ease-in-out rounded-md shadow-md sm:w-full sm:col-span-2 aspect-square group-hover:ring-4 ring-gb-highlight"
        src={thumbnailUrl || DEFAULT_IMAGE_URL}
        alt={`Thumbnail image for post titled - ${title}`}
        width={320}
        height={320}
        loading="lazy"
        quality={100}
      />
    </CustomLink>

    <div className="sm:col-span-3">
      <CustomLink href={slug} as={slug} className="text-lg">
        {title}
      </CustomLink>
      <p className="mt-2 text-xs leading-normal sm:text-base line-clamp-2 sm:line-clamp-3 bg-gb-bg">
        {description || ''}
      </p>
    </div>
  </div>
)
