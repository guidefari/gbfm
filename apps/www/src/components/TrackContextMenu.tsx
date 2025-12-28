import type { SelectMix } from '@gbfm/vps/schemas'
import { Heart, Play, Plus, Share2 } from 'lucide-react'
import type React from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { toast } from '@/components/ui/use-toast'
import { useAudioPlayerActions } from '@/store/audioPlayer'

interface TrackContextMenuProps {
  track: SelectMix
  children: React.ReactNode
  className?: string
}

export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({
  track,
  children,
  className = ''
}) => {
  const { addToQueue, loadTrack } = useAudioPlayerActions()

  const handleAddToQueue = () => {
    addToQueue(track)
  }

  const handlePlayNow = () => {
    loadTrack(track.url, track.thumbnailUrl || '', track.title)
  }

  const handleAddToFavorites = () => {
    console.log('Add to favorites:', track.title)
  }

  const handleShare = async () => {
    const shareUrl = `https://vps.goosebumps.fm/share/mix/${track.slug}`

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

  return (
    <ContextMenu>
      <ContextMenuTrigger className={className}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handlePlayNow}>
          <Play className='w-4 h-4' />
          Play now
        </ContextMenuItem>

        <ContextMenuItem onClick={handleAddToQueue}>
          <Plus className='w-4 h-4' />
          Add to queue
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleAddToFavorites}>
          <Heart className='w-4 h-4' />
          Add to favorites
        </ContextMenuItem>

        <ContextMenuItem onClick={handleShare}>
          <Share2 className='w-4 h-4' />
          Share
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
