import { CustomLink } from '@gbfm/ui'
import type React from 'react'
import { Artwork } from './common/Artwork'

interface Props {
  date?: string
  title: string
  description?: string
  thumbnailUrl?: string
  slug: string
}

export const PostCard: React.FC<Props> = ({ title, description, thumbnailUrl, slug }) => (
  <div className='grid px-1 pb-4 border-2 border-t-0 border-l-0 rounded-md shadow-lg sm:grid-flow-col sm:grid-cols-5 border-gb-tomato'>
    <CustomLink href={slug} className='my-auto text-xl group sm:mr-3 sm:col-span-2'>
      <Artwork
        src={thumbnailUrl}
        alt={`${title} thumbnail`}
        radius='md'
        border='none'
        className='w-32 shadow-md sm:w-full sm:col-span-2'
        imageClassName='transition ease-in-out group-hover:ring-4 ring-gb-highlight'
        width={320}
        height={320}
      />
    </CustomLink>

    <div className='sm:col-span-3'>
      <CustomLink href={slug} className='text-lg'>
        {title}
      </CustomLink>
      <p className='mt-2 text-xs leading-normal sm:text-base line-clamp-2 sm:line-clamp-3 bg-gb-bg'>
        {description || ''}
      </p>
    </div>
  </div>
)
