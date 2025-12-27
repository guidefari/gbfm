import type { SelectMix } from '@gbfm/vps/schemas'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Heart, MoreVertical, Play, Plus, Share, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef } from 'react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { BaseAudioPlayer } from '@/components/common/BaseAudioPlayer'
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
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

export const Route = createFileRoute('/mixes')({
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

function CompactAudioPlayer() {
  return (
    <BaseAudioPlayer
      variant='compact'
      showVolume={false}
      showQueue={false}
      showTrackActions={false}
      showFullscreenToggle={false}
    />
  )
}

function Component() {
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAudioByType('mix')
  const { mixesSorting, showCompactPlayer, toggleCompactPlayer } = useUIStore()
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

  const playerRef = useRef<HTMLDivElement>(null)

  const handleFocusTrap = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && playerRef.current) {
      const focusableElements = Array.from(
        playerRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ) as HTMLElement[]

      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    } else if (e.key === 'Escape') {
      toggleCompactPlayer()
    }
  }

  if (isPending) {
    return <MixesSkeleton />
  }

  return (
    <div className='relative h-full font-jetbrains bg-background text-foreground'>
      <div className='grid h-full grid-cols-1 gap-4 p-4 md:grid-cols-2'>
        {/* Left Column - Mix Details (Outlet) */}
        <div className='p-4 overflow-y-auto border-2 border-dashed rounded-sm border-muted-foreground/30 bg-card/10'>
          <Outlet />
        </div>

        {/* Right Column - Mixes List */}
        <div className='p-4 overflow-y-auto border-2 border-dashed rounded-sm border-muted-foreground/30 bg-card/10'>
          <h2 className='flex items-center gap-2 mb-4 text-lg font-bold'>
            <div className='w-2 h-2 rounded-sm bg-foreground/30' />
            Mixes
          </h2>
          <div className='grid gap-2'>
            {sortedData?.map((mix) => {
              const isActive = nowPlayingContext?.title === mix.title
              return (
                <TrackContextMenu key={mix.id} track={mix}>
                  <article
                    className={cn(
                      'flex gap-3 items-start p-2 transition-all duration-300 cursor-pointer hover:bg-muted/50 rounded-sm group',
                      isActive && 'ring-1 ring-border bg-accent/5 shadow-sm'
                    )}>
                    <button
                      type='button'
                      className='relative flex-shrink-0 focus:outline-none'
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
                        className='object-cover transition-transform duration-300 border rounded-sm w-14 h-14 border-border bg-background group-hover:scale-105'
                      />
                      <span
                        className={cn(
                          'absolute inset-0 flex items-center justify-center transition-all duration-300 rounded-sm bg-black/50',
                          isActive
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'
                        )}>
                        {isActive && isPlaying ? (
                          <GiPauseButton className='text-2xl text-white drop-shadow' />
                        ) : (
                          <GiPlayButton className='text-2xl text-white drop-shadow' />
                        )}
                      </span>
                    </button>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-start justify-between gap-2'>
                        <Link
                          to='/mixes/$mixId'
                          params={{ mixId: mix.slug }}
                          className='flex-1 block font-bold leading-none truncate text-foreground hover:underline decoration-foreground/30 underline-offset-4'>
                          {mix.title}
                        </Link>
                        <MixMenu mix={mix} />
                      </div>
                      {mix.description && (
                        <div className='mt-1 text-sm leading-relaxed text-foreground/60 line-clamp-2'>
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
                className='p-4 mt-2 text-sm font-medium transition-all duration-300 border rounded-sm bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed border-border/50'>
                {isFetchingNextPage ? 'Loading...' : 'Load More'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Audio Player */}
      <AnimatePresence>
        {showCompactPlayer && (
          <motion.div
            ref={playerRef}
            initial={{ opacity: 0, y: 50, scale: 0.9, x: -20 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: 50, scale: 0.9, x: -20 }}
            transition={{ type: 'keyframes', damping: 20, stiffness: 300 }}
            onKeyDown={handleFocusTrap}
            className='fixed bottom-6 left-20 z-50 hidden md:block w-[320px] p-6 overflow-hidden border border-border/50 rounded-sm bg-background/95 backdrop-blur-md shadow-2xl border-solid'>
            <button
              type='button'
              ref={(node) => {
                if (node && showCompactPlayer) node.focus()
              }}
              onClick={toggleCompactPlayer}
              className='absolute z-10 p-1 transition-colors rounded-sm top-3 right-3 hover:bg-muted'
              aria-label='Close player'>
              <X className='w-4 h-4 text-foreground/50 hover:text-foreground' />
            </button>
            <CompactAudioPlayer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
