import Image from 'next/future/image'
import React from 'react'
import CustomLink from './CustomLink'

interface Props {
  date?: string
  title: string
  description?: string
  thumbnailUrl?: string
  slug: string
}

export const PostCard: React.FC<Props> = ({ date, title, description, thumbnailUrl, slug }) => {
  return (
    <div className="sm:flex lg:items-start group">
      <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
        <Image
          className="object-cover w-full rounded-md sm:h-32 sm:w-32"
          src={
            thumbnailUrl ||
            'https://res.cloudinary.com/hokaspokas/image/upload/v1658044917/goosebumpsfm/generic_xvsrwv.svg'
          }
          alt={`Thumbnail image for post titled - ${title}`}
          width={320}
          height={320}
          loading="lazy"
          quality={100}
        />
      </div>
      <div>
        <span className="text-sm opacity-80">{date || ''}</span>
        <p className="mt-3 text-lg font-medium leading-6">
          <CustomLink href={slug} as={slug} className="text-xl ">
            {title}
          </CustomLink>
        </p>
        <p className="mt-2 leading-normal text">{description || ''}</p>
      </div>
    </div>
  )
}
