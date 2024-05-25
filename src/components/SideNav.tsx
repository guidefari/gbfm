import Link from 'next/link'
import { RSS } from './RSS'
import { Youtube } from './Youtube'

export const SideNav = () => {
  const pagesAndPages = [
    {
      name: 'Words',
      slug: '/words',
    },
    {
      name: '!Tweets',
      slug: '/micro',
    },
    {
      name: 'Labels',
      slug: '/labels',
    },
    {
      name: 'Mixes',
      slug: '/mixes',
    },
    {
      name: '!Newsletter',
      slug: '/newslater',
    },
  ]

  return (
    <div className="top-0 flex flex-wrap items-center px-2 my-1 space-x-2 lg:fixed lg:items-start lg:space-x-0 lg:space-y-3 lg:flex-col ">
      {pagesAndPages.map((page, index) => (
        <Link
          key={index}
          href={page.slug}
          className="cursor-pointer leading-none  lg:w-24
            transition-transform duration-150
            transform text-sm text-white
            lg:hover:scale-[2.5] lg:hover:translate-x-16 hover:text-gb-highlight "
        >
          {page.name}
        </Link>
      ))}
      <div className="flex items-center justify-center space-x-1 ">
        <RSS />
        <Youtube />
      </div>
    </div>
  )
}
