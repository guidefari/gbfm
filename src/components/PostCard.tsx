import Image from 'next/image'
import React from 'react'
import { format, parseISO } from 'date-fns'
import CustomLink from './CustomLink'

interface Props {
  date?: string
  title: string
  description?: string
  thumbnailUrl?: string
  slug: string
}

export const PostCard: React.FC<Props> = ({ date, title, description, thumbnailUrl, slug }) => (
  <div className="sm:flex lg:items-start group">
    <CustomLink href={slug} as={slug} className="text-xl ">
      <div className="mb-4 sm:mb-0 sm:mr-4">
        <Image
          className="object-cover w-32 transition ease-in-out rounded-md aspect-square group-hover:ring-4"
          src={
            thumbnailUrl ||
            'https://res.cloudinary.com/hokaspokas/image/upload/v1663215741/goosebumpsfm/generic_Thumb.svg'
          }
          alt={`Thumbnail image for post titled - ${title}`}
          width={320}
          height={320}
          loading="lazy"
          quality={100}
        />
      </div>
      <div>
        <time dateTime={date} className="text-xs opacity-80 bg-gb-bg">
          {format(parseISO(date), 'LLLL d, yyyy')}
        </time>
        <p className="text-lg font-medium leading-6 bg-gb-bg">{title}</p>
        <p className="hidden mt-2 text-sm leading-normal sm:block bg-gb-bg">{description || ''}</p>
      </div>
    </CustomLink>
  </div>
)
