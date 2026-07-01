import { Button, toast } from '@gbfm/ui'
import { Heart, Loader2 } from 'lucide-react'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import {
  useAddFavorite,
  useAddShowFavorite,
  useFavorites,
  useRemoveFavorite,
  useRemoveShowFavorite
} from '@/lib/http'
import { log } from '@/services/logger'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  contentType: 'mix' | 'show'
  contentId: string
  contentTitle: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function FavoriteButton({
  contentType,
  contentId,
  contentTitle,
  variant = 'outline',
  size = 'sm',
  className
}: FavoriteButtonProps) {
  const { requireAuth } = useAuthGuard(contentType)

  const { data: favorites } = useFavorites()
  const { addFavorite, isPending: isAddingFavorite } = useAddFavorite()
  const { removeFavorite, isPending: isRemovingFavorite } = useRemoveFavorite()
  const { addShowFavorite, isPending: isAddingShowFavorite } = useAddShowFavorite()
  const { removeShowFavorite, isPending: isRemovingShowFavorite } = useRemoveShowFavorite()

  const isFavorited =
    contentType === 'mix'
      ? favorites.some((f) => f.audioId === contentId)
      : favorites.some((f) => f.showId === contentId)

  const isLoading =
    isAddingFavorite || isRemovingFavorite || isAddingShowFavorite || isRemovingShowFavorite

  const performFavoriteAction = async () => {
    try {
      if (contentType === 'mix') {
        if (isFavorited) {
          await removeFavorite({ audioId: contentId })
          toast({
            title: 'Removed from favorites',
            description: `${contentTitle} removed from your favorites`
          })
        } else {
          await addFavorite({ audioId: contentId })
          toast({
            title: 'Added to favorites',
            description: `${contentTitle} added to your favorites`
          })
        }
      } else {
        if (isFavorited) {
          await removeShowFavorite({ showId: contentId })
          toast({
            title: 'Removed from favorites',
            description: `${contentTitle} removed from your favorites`
          })
        } else {
          await addShowFavorite({ showId: contentId })
          toast({
            title: 'Added to favorites',
            description: `${contentTitle} added to your favorites. You'll be notified of new episodes.`
          })
        }
      }
    } catch (error) {
      log('error', 'Favorite action failed', { contentType, contentId, error })
      const message = error instanceof Error ? error.message.toLowerCase() : ''
      if (message.includes('already favorited') || message.includes('409')) {
        toast({
          title: 'Already in favorites',
          description: `${contentTitle} is already in your favorites`
        })
      } else {
        toast({
          title: 'Something went wrong',
          description: 'Please try again',
          variant: 'destructive'
        })
      }
    }
  }

  const handleClick = () => {
    requireAuth(() => performFavoriteAction())
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      variant={variant}
      size={size}
      className={cn(className)}
      title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}>
      {isLoading ? (
        <Loader2 className='w-4 h-4 animate-spin' />
      ) : (
        <Heart className={cn('w-4 h-4', isFavorited && 'fill-red-500 text-red-500')} />
      )}
    </Button>
  )
}
