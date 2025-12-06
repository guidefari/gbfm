import type { SelectMix } from '@gbfm/vps/schemas'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Heart, MoreVertical, Play, Plus, Share } from 'lucide-react'
import { useMemo } from 'react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { MixesSkeleton } from '@/components/MixesSkeleton'
import { TrackContextMenu } from '@/components/TrackContextMenu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAudioByType } from '@/lib/http'
import { useUIStore } from '@/store'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

export const Route = createFileRoute('/mixes/')({
  component: Component
})

interface MixMenuProps {
  mix: SelectMix
}

function MixMenu({ mix }: MixMenuProps) {
  const { addToQueue, loadTrack } = useAudioPlayerActions()

  const handleShare = async () => {
    const shareUrl = `https://vps.goosebumps.fm/share/mix/${mix.slug}`

    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: 'Link copied!',
        description: 'Share URL copied to clipboard'
      })
    } catch (error) {
      console.error('Failed to copy link to clipboard:', error)
      toast({
        title: 'Failed to copy',
        description: 'Could not copy link to clipboard',
        variant: 'destructive'
      })
    }
  }

  const handlePlayNow = () => {
    loadTrack(mix.url, mix.thumbnailUrl || DEFAULT_IMAGE_URL, mix.title)
  }

  const handleAddToQueue = () => {
    addToQueue(mix)
  }

  const handleAddToFavorites = () => {
    console.log('Add to favorites:', mix.title)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          onClick={(e) => e.stopPropagation()}
          className='flex-shrink-0 p-1 transition-colors rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-highlight'
          aria-label='More actions'>
          <MoreVertical className='w-4 h-4 text-foreground/60 hover:text-foreground' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start'>
        <DropdownMenuItem onClick={handlePlayNow}>
          <Play className='w-4 h-4' />
          Play now
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleAddToQueue}>
          <Plus className='w-4 h-4' />
          Add to queue
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleAddToFavorites}>
          <Heart className='w-4 h-4' />
          Add to favorites
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleShare}>
          <Share className='w-4 h-4' />
          Share
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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
    <div className='grid h-full grid-cols-3 gap-4 p-4 font-jetbrains bg-background text-foreground'>
      {/* Left Column - Dummy Content */}
      <div className='p-4 overflow-y-auto border-2 border-dashed rounded-lg border-muted-foreground/30'>
        <h2 className='mb-4 text-lg font-bold'>Audio player</h2>
      </div>

      {/* Middle Column - Dummy Content */}
      <div className='p-4 overflow-y-auto border-2 border-dashed rounded-lg border-muted-foreground/30'>
        <h2 className='mb-4 text-lg font-bold'>Single Mix details</h2>
      </div>

      {/* Right Column - Mixes List */}
      <div className='p-4 overflow-y-auto border-2 border-dashed rounded-lg border-muted-foreground/30'>
        <h2 className='mb-4 text-lg font-bold'>Mixes</h2>
        <div className='grid gap-2'>
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
                      className='object-cover border rounded-lg w-14 h-14 border-border bg-background'
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
                    <div className='flex items-start justify-between gap-2'>
                      <Link
                        to='/mixes/$mixId'
                        params={{ mixId: mix.slug }}
                        className='flex-1 block font-bold leading-none truncate text-highlight hover:underline'>
                        {mix.title}
                      </Link>
                      <MixMenu mix={mix} />
                    </div>
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
      </div>
    </div>
  )
}
