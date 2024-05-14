import Link from 'next/link'
import { RSS } from './RSS'

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
    <div className="lg:fixed top-0 flex-wrap flex items-center lg:items-start lg:space-x-0 lg:space-y-3 space-x-2 my-1 lg:flex-col px-2 ">
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
      <div className=" flex items-center justify-center">
        <RSS />
      </div>
    </div>
  )
}
