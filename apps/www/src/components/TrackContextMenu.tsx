import { useFeatureFlag } from '@gbfm/core/feature-flags'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  toast
} from '@gbfm/ui'
import type { SelectAudio } from '@gbfm/vps/schemas'
import { log } from '@/services/logger'
import { Heart, HeartOff, Play, Plus, Share2 } from 'lucide-react'
import type React from 'react'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useAddFavorite, useFavorites, useRemoveFavorite } from '@/lib/http'
import { getShareUrl } from '@/lib/share'
import { usePlayerActions } from '@/services/player'
import { toQueueTrack } from '@/services/player/toQueueTrack'

interface TrackContextMenuProps {
  track: SelectAudio
  children: React.ReactNode
  className?: string
}

export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({
  track,
  children,
  className = ''
}) => {
  const isShareEnabled = useFeatureFlag('ui.share')
  const isQueueEnabled = useFeatureFlag('ui.queue')
  const { enqueue, playTrack } = usePlayerActions()
  const { requireAuth } = useAuthGuard('mix')
  const { data: favorites } = useFavorites()
  const { addFavorite } = useAddFavorite()
  const { removeFavorite } = useRemoveFavorite()

  const isFavorited = favorites.some((f) => f.audioId === track.id)

  const handleAddToQueue = () => {
    enqueue(toQueueTrack(track))
  }

  const handlePlayNow = () => {
    playTrack(toQueueTrack(track))
  }

  const performFavoriteAction = async () => {
    try {
      if (isFavorited) {
        await removeFavorite({ audioId: track.id })
        toast({
          title: 'Removed from favorites',
          description: `${track.title} removed from your favorites`
        })
      } else {
        await addFavorite({ audioId: track.id })
        toast({
          title: 'Added to favorites',
          description: `${track.title} added to your favorites`
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update favorites',
        variant: 'destructive'
      })
    }
  }

  const handleToggleFavorite = () => {
    requireAuth(() => performFavoriteAction())
  }

  const handleShare = async () => {
    const shareUrl = getShareUrl(track.type === 'track' ? 'track' : 'mix', track.slug)

    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: 'Link copied!',
        description: 'Share URL copied to clipboard'
      })
    } catch (error) {
      log('error', 'Failed to copy link to clipboard', { track: track.slug, error })
      toast({
        title: 'Failed to copy',
        description: 'Could not copy link to clipboard',
        variant: 'destructive'
      })
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className={className}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handlePlayNow}>
          <Play className='w-4 h-4' />
          Play now
        </ContextMenuItem>

        {isQueueEnabled && (
          <ContextMenuItem onClick={handleAddToQueue}>
            <Plus className='w-4 h-4' />
            Add to queue
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleToggleFavorite}>
          {isFavorited ? (
            <>
              <HeartOff className='w-4 h-4' />
              Remove from favorites
            </>
          ) : (
            <>
              <Heart className='w-4 h-4' />
              Add to favorites
            </>
          )}
        </ContextMenuItem>

        {isShareEnabled && (
          <ContextMenuItem onClick={handleShare}>
            <Share2 className='w-4 h-4' />
            Share
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
