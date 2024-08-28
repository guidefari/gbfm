import Album from '@/components/Album'
import Track from '@/components/Track'
import HorizontalScrollCards from '@/components/common/HorizontalScrollCards'

export default function component() {
  const textList = ['Words', 'Less Words', 'Labels', 'Mixes', '!Newsletter', 'Mixes via RSS!']

  const pagesAndPages = [
    {
      name: 'Words',
      slug: 'words',
    },
    {
      name: 'Less Words',
      slug: 'words',
    },
    {
      name: 'Labels',
      slug: 'words',
    },
    {
      name: 'Mixes',
      slug: 'words',
    },
    {
      name: '!Newsletter',
      slug: 'words',
    },
    {
      name: 'Mixes - RSS',
      slug: 'words',
    },
  ]

  return (
    <div className="flex flex-col items-start max-w-3xl px-2">
      {pagesAndPages.map((text, index) => (
        <p
          key={text.slug}
          className="cursor-pointer leading-none my-2 w-24
            transition-transform duration-150
            transform text-sm
            hover:scale-[2.5] hover:translate-x-16 hover:text-gb-highlight "
        >
          {text.name}
        </p>
      ))}
    </div>
  )
}
