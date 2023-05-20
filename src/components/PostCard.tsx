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
    <CustomLink href={slug} as={slug} className="text-xl">
      <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
        <Image
          className="object-cover w-full transition ease-in-out rounded-md sm:h-32 sm:w-32 group-hover:ring-4"
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
        <p className="mt-3 text-lg font-medium leading-6">{title}</p>
        <p className="mt-2 text-sm leading-normal">{description || ''}</p>
        <time dateTime={date} className="text-sm opacity-80">
          {format(parseISO(date), 'LLLL d, yyyy')}
        </time>
      </div>
    </CustomLink>
  </div>
)
