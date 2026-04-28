import { useFeatureFlag } from '@gbfm/core/feature-flags'
import type { SelectAudio } from '@gbfm/vps/schemas'
import { Heart, HeartOff, MoreVertical, Play, Plus, Share2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAddFavorite, useFavorites, useRemoveFavorite } from '@/lib/http'
import { getShareUrl } from '@/lib/share'
import { cn } from '@/lib/utils'
import { useAudioPlayerActions } from '@/store/audioPlayer'

interface MixMenuProps {
  mix: SelectAudio
}

export function MixMenu({ mix }: MixMenuProps) {
  const isShareEnabled = useFeatureFlag('ui.share')
  const isQueueEnabled = useFeatureFlag('ui.queue')
  const { addToQueue, loadTrack } = useAudioPlayerActions()
  const { requireAuth } = useAuthGuard('mix')
  const { data: favorites } = useFavorites()
  const { addFavorite } = useAddFavorite()
  const { removeFavorite } = useRemoveFavorite()

  const isFavorited = favorites.some((f) => f.audioId === mix.id)

  const handleShare = async () => {
    const shareUrl = getShareUrl('mix', mix.slug)

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
    loadTrack(
      mix.url,
      mix.thumbnailUrl || DEFAULT_IMAGE_URL,
      mix.title,
      mix.id,
      mix.creators,
      mix.slug
    )
  }

  const handleAddToQueue = () => {
    addToQueue(mix)
  }

  const performFavoriteAction = async () => {
    try {
      if (isFavorited) {
        await removeFavorite({ audioId: mix.id })
        toast({
          title: 'Removed from favorites',
          description: `${mix.title} removed from your favorites`
        })
      } else {
        await addFavorite({ audioId: mix.id })
        toast({
          title: 'Added to favorites',
          description: `${mix.title} added to your favorites`
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'shrink-0 p-1 transition-colors rounded-none hover:bg-muted focus:outline-none focus:ring-2 focus:ring-highlight'
          )}
          aria-label='More actions'>
          <MoreVertical className='w-5 h-5 text-foreground/60 hover:text-foreground' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={handlePlayNow}>
          <Play className='w-4 h-4' />
          Play now
        </DropdownMenuItem>

        {isQueueEnabled && (
          <DropdownMenuItem onClick={handleAddToQueue}>
            <Plus className='w-4 h-4' />
            Add to queue
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleToggleFavorite}>
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
        </DropdownMenuItem>

        {isShareEnabled && (
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className='w-4 h-4' />
            Share
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
