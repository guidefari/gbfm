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
  <div className="grid pb-2 border-2 border-t-0 border-l-0 rounded-md shadow-lg sm:grid-flow-col sm:grid-cols-5 border-gb-tomato">
    <CustomLink href={slug} as={slug} className="text-xl group sm:mr-2 sm:col-span-2">
      <Image
        className="object-cover w-32 transition ease-in-out rounded-md shadow-md sm:col-span-2 aspect-square group-hover:ring-4"
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
      <h4 className="text-lg font-medium leading-6 group-hover:font-bold bg-gb-bg">{title}</h4>
    </CustomLink>
    <p className="hidden max-w-xs mt-2 text-sm leading-normal sm:col-span-3 text-ellipsis sm:block bg-gb-bg">
      {description || ''}
    </p>
  </div>
)
