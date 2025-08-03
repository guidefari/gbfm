import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { useAudioPlayerContext } from '@/contexts/AudioPlayer'
import { useAudioByType } from '@/lib/http'
import { useUIStore } from '@/store'

export const Route = createFileRoute('/mixes')({
  component: Component
})

function Component() {
  const { data } = useAudioByType('mix')
  const { mixesSorting } = useUIStore()
  const [, handlers, isPlaying, , , nowPlayingContext] = useAudioPlayerContext()

  const sortedData = useMemo(() => {
    if (!data) return []

    const sorted = [...data].sort((a, b) => {
      if (mixesSorting.sortBy === 'date') {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return mixesSorting.sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      } else {
        const titleA = a.title.toLowerCase()
        const titleB = b.title.toLowerCase()
        if (mixesSorting.sortOrder === 'asc') {
          return titleA.localeCompare(titleB)
        } else {
          return titleB.localeCompare(titleA)
        }
      }
    })

    return sorted
  }, [data, mixesSorting.sortBy, mixesSorting.sortOrder])

  return (
    <div className='grid gap-2 p-2 min-h-screen font-jetbrains bg-background text-foreground'>
      {sortedData?.map((mix) => {
        const isActive = nowPlayingContext?.title === mix.title
        return (
          <article
            key={mix.id}
            className={`flex gap-3 items-center p-2  transition-colors ${isActive ? 'ring-2 ring-highlight' : ''}`}>
            <button
              type='button'
              className='relative group focus:outline-none'
              onClick={() =>
                handlers.handleAlbumArtClick(
                  mix.url,
                  mix.thumbnailUrl,
                  mix.title
                )
              }>
              <img
                src={mix.thumbnailUrl}
                alt={mix.title}
                className='w-14 h-14 border border-border bg-background'
              />
              <span
                className={`absolute inset-0 flex items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'}`}>
                {isActive && isPlaying ? (
                  <GiPauseButton className='text-2xl drop-shadow text-highlight' />
                ) : (
                  <GiPlayButton className='text-2xl drop-shadow text-highlight' />
                )}
              </span>
            </button>
            <div className='flex-1'>
              <Link
                to='/read/$archetype/$id'
                params={{ archetype: 'mix', id: mix.slug }}
                className='font-bold text-highlight hover:underline'>
                {mix.title}
              </Link>
              {mix.description && (
                <span className='ml-2 text-foreground/80'>
                  {mix.description}
                </span>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
