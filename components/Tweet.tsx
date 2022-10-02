import Image from 'next/future/image'
import React from 'react'

interface Props {
  authorName: string
  handle: string
  avatarUrl: string
  date: string
  children: React.ReactNode
}

export const Tweet: React.FC<Props> = ({ authorName, children, date, handle, avatarUrl }) => {
  return (
    <div className="relative py-3 sm:max-w-xl sm:mx-auto">
      <div className="w-full px-6 py-4 my-4 border border-gray-300 rounded-2xl">
        <div className="flex items-center">
          <a
            className="flex w-12 h-12 mr-3"
            href={`https://twitter.com/${handle}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              alt={authorName}
              src={avatarUrl}
              width={48}
              height={48}
              className="rounded-full"
            />
          </a>
          <a
            href="https://twitter.com/guidefari"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col ml-4"
          >
            <span className="flex items-center font-bold leading-5 " title={authorName}>
              {authorName}
            </span>
            <span className="" title={`@${handle}`}>
              {' '}
              @{handle}{' '}
            </span>
          </a>
        </div>
        <div className="mt-4 mb-2 text-lg leading-normal whitespace-pre-wrap">{children}</div>
        {new Date(date).toLocaleString('en-US', {
          day: '2-digit',
          year: 'numeric',
          month: 'long',
        })}
      </div>
    </div>
  )
}
