import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { MixesSkeleton } from '@/components/MixesSkeleton'
import { TrackContextMenu } from '@/components/TrackContextMenu'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAudioByType } from '@/lib/http'
import { useUIStore } from '@/store'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

export const Route = createFileRoute('/mixes/')({
  component: Component
})

function Component() {
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAudioByType('mix')
  const { mixesSorting } = useUIStore()
  const { isPlaying, nowPlayingContext } = useAudioPlayerState()
  const { loadTrack } = useAudioPlayerActions()

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

  if (isPending) {
    return <MixesSkeleton />
  }

  return (
    <div className='grid gap-2 p-2 max-w-lg min-h-screen font-jetbrains bg-background text-foreground'>
      {sortedData?.map((mix) => {
        const isActive = nowPlayingContext?.title === mix.title
        return (
          <TrackContextMenu key={mix.id} track={mix}>
            <article
              className={`flex gap-3 items-start p-2 transition-colors cursor-pointer hover:bg-muted/50 rounded-lg ${isActive ? 'ring-2 ring-highlight bg-primary/5' : ''}`}>
              <button
                type='button'
                className='relative group focus:outline-none'
                onClick={() =>
                  loadTrack(
                    mix.url,
                    mix.thumbnailUrl || DEFAULT_IMAGE_URL,
                    mix.title
                  )
                }>
                <img
                  src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
                  alt={mix.title}
                  className='object-cover w-14 h-14 rounded-lg border border-border bg-background'
                />
                <span
                  className={`absolute inset-0 flex items-center justify-center transition-opacity rounded-lg bg-black/50 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'}`}>
                  {isActive && isPlaying ? (
                    <GiPauseButton className='text-2xl drop-shadow text-highlight' />
                  ) : (
                    <GiPlayButton className='text-2xl drop-shadow text-highlight' />
                  )}
                </span>
              </button>
              <div className='flex-1 min-w-0'>
                <Link
                  to='/mixes/$mixId'
                  params={{ mixId: mix.slug }}
                  className='block font-bold leading-none truncate text-highlight hover:underline'>
                  {mix.title}
                </Link>
                {mix.description && (
                  <div className='text-sm text-foreground/80 line-clamp-2'>
                    {mix.description}
                  </div>
                )}
              </div>
            </article>
          </TrackContextMenu>
        )
      })}

      {hasNextPage && (
        <button
          type='button'
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className='p-4 text-sm font-medium transition-colors rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed'>
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  )
}
