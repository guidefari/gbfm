import Image from 'next/future/image'

interface Props {
  authorName: string
  handle: string
  avatarUrl: string
  date: string
  children: React.ReactNode
}

export const Tweet: React.FC<Props> = ({ authorName, children, date, handle, avatarUrl }) => {
  return (
    <div className="flex flex-col justify-center min-h-screen py-6 bg-gray-100 sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="w-full px-6 py-4 my-4 border border-gray-300 rounded-2xl">
          <div className="flex items-center">
            <a
              className="flex w-12 h-12 mr-3"
              href={`https://twitter.com/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image alt={authorName} src={avatarUrl} className="rounded-full" />
            </a>
            <a
              href="https://twitter.com/guidefari"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col ml-4"
            >
              <span
                className="flex items-center font-bold leading-5 text-gray-900"
                title="{author.name}"
              >
                {authorName}
              </span>
              <span className="text-gray-500" title="{`@guidefari`}">
                {' '}
                @{handle}{' '}
              </span>
            </a>
          </div>
          <div className="mt-4 mb-2 text-lg leading-normal text-gray-700 whitespace-pre-wrap">
            {children}
          </div>
          {date}
        </div>
      </div>
    </div>
  )
}
