import Image from 'next/image'
import React from 'react'
import CustomLink from './CustomLink'

interface Props {
  date?: string
  title: string
  description?: string
  thumbnailUrl?: string
  slug: string
}

export const PostCard: React.FC<Props> = ({ date, title, description, thumbnailUrl, slug }) => (
  <div className="grid pb-4 border-2 border-t-0 border-l-0 rounded-md shadow-lg sm:grid-flow-col sm:grid-cols-5 border-gb-tomato">
    <CustomLink href={slug} as={slug} className="text-xl group sm:mr-3 sm:col-span-2">
      <Image
        className="object-cover w-32 transition ease-in-out rounded-md shadow-md sm:w-full sm:col-span-2 aspect-square group-hover:ring-4"
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
    </CustomLink>

    <p className="max-w-xs mx-1 mt-2 leading-normal sm:col-span-3 text-ellipsis bg-gb-bg">
      <CustomLink href={slug} as={slug} className="text-lg">
        {title}
      </CustomLink>
      <span className="hidden sm:inline-block"> {description || ''}</span>
    </p>
  </div>
)
