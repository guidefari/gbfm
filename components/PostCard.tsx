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
            'https://res.cloudinary.com/hokaspokas/image/upload/v1657259208/here-hugo/fmfm_hyskxj.svg'
          }
          alt="text"
          width={128}
          height={128}
          loading="lazy"
        />
      </div>
      <div>
        <span className="text-sm text-gray-500">{date || ''}</span>
        <p className="mt-3 text-lg font-medium leading-6">
          <CustomLink href={slug} as={slug} className="text-xl text-gray-800 hover:text-gray-500">
            {title}
          </CustomLink>
        </p>
        <p className="mt-2 leading-normal text-gray-500 text">{description || ''}</p>
      </div>
    </div>
  )
}
