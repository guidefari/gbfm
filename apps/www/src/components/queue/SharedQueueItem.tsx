import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Heart, MoreHorizontal, Play, Plus, Share2, X } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useAudioPlayerActions } from '@/store/audioPlayer'

interface Track {
  queueId: string
  id: string
  title: string
  url: string
  thumbnailUrl: string
  addedAt: number
}

interface SharedQueueItemProps {
  track: Track
  index: number
  isCurrentTrack: boolean
  variant?: 'compact' | 'fullscreen'
  showDragHandle?: boolean
  showContextMenu?: boolean
  showRemoveButton?: boolean
  fontSize?: 'sm' | 'base' | 'lg' | 'xl'
  disableInternalDrag?: boolean
}

interface ContextMenuState {
  isOpen: boolean
  x: number
  y: number
}

export const SharedQueueItem: React.FC<SharedQueueItemProps> = ({
  track,
  index,
  isCurrentTrack,
  variant = 'compact',
  showContextMenu = false,
  showRemoveButton = true,
  fontSize = 'base',
  disableInternalDrag = false
}) => {
  const { playFromQueue, removeFromQueue, addToQueue, loadTrack } =
    useAudioPlayerActions()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: track.queueId })

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0
  })
  const menuRef = useRef<HTMLDivElement>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const handlePlay = () => {
    playFromQueue(index)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    removeFromQueue(track.queueId)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()

    const x = Math.min(e.clientX, window.innerWidth - 200)
    const y = Math.min(e.clientY, window.innerHeight - 200)

    setContextMenu({
      isOpen: true,
      x,
      y
    })
  }

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }))
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu()
      }
    }

    if (contextMenu.isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu.isOpen, closeContextMenu])

  const handlePlayNow = () => {
    loadTrack(track.url, track.thumbnailUrl, track.title, track.id)
    closeContextMenu()
  }

  const handleAddToQueue = () => {
    const mixData = {
      id: track.id,
      title: track.title,
      url: track.url,
      thumbnailUrl: track.thumbnailUrl,
      slug: '',
      description: '',
      tags: [],
      content: '',
      draft: false,
      type: 'track' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    addToQueue(mixData)
    closeContextMenu()
  }

  const handleAddToFavorites = () => {
    console.log('Add to favorites:', track.title)
    closeContextMenu()
  }

  const handleShare = () => {
    console.log('Share:', track.title)
    closeContextMenu()
  }

  const isCompact = variant === 'compact'
  const isFullscreen = variant === 'fullscreen'

  const getFontSizeClasses = () => {
    switch (fontSize) {
      case 'sm':
        return 'text-sm'
      case 'base':
        return 'text-base'
      case 'lg':
        return 'text-lg'
      case 'xl':
        return 'text-xl'
      default:
        return 'text-base'
    }
  }

  const getSubtitleFontSizeClasses = () => {
    switch (fontSize) {
      case 'sm':
        return 'text-xs'
      case 'base':
        return 'text-sm'
      case 'lg':
        return 'text-base'
      case 'xl':
        return 'text-lg'
      default:
        return 'text-sm'
    }
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: Div required for drag-and-drop functionality with @dnd-kit/sortable */}
      <div
        ref={setNodeRef}
        style={style}
        // {...(isCompact && !disableInternalDrag ? { ...attributes, ...listeners } : {})}
        {...attributes}
        {...listeners}
        className={cn(
          'group flex items-center transition-colors overflow-hidden w-full',
          // Compact variant
          isCompact && [
            'gap-3 p-2 hover:bg-muted/50',
            !disableInternalDrag && 'cursor-grab active:cursor-grabbing',
            isDragging && 'opacity-50 shadow-lg'
          ],
          // Fullscreen variant
          isFullscreen && [
            'gap-4 p-3 rounded-sm hover:bg-muted/50 cursor-pointer',
            isCurrentTrack && 'bg-primary/10 border border-primary/20',
            isDragging && 'opacity-50 shadow-lg'
          ]
        )}
        onClick={handlePlay}
        onContextMenu={showContextMenu ? handleContextMenu : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handlePlay()
          }
        }}
        role='button'
        tabIndex={0}>
        {/* Album Art */}
        <div
          className={cn(
            'overflow-hidden relative flex-shrink-0 rounded',
            isCompact && 'w-10 h-10',
            isFullscreen && 'w-12 h-12 rounded-sm'
          )}>
          <img
            src={track.thumbnailUrl || DEFAULT_IMAGE_URL}
            alt={track.title}
            className='object-cover w-full h-full'
          />
          <div className='absolute inset-0 flex items-center justify-center transition-opacity opacity-0 bg-black/40 group-hover:opacity-100'>
            <Button
              variant='ghost'
              size='sm'
              onClick={handlePlay}
              className={cn(
                'p-0 text-white border-0 bg-white/20 hover:bg-white/30',
                isCompact && 'w-6 h-6',
                isFullscreen && 'w-8 h-8'
              )}>
              <Play
                className={cn(
                  isCompact && 'w-3 h-3',
                  isFullscreen && 'w-4 h-4'
                )}
              />
            </Button>
          </div>
        </div>

        {/* Track Info */}
        <div
          className={cn(
            'flex-1 min-w-0',
            isCompact && [getFontSizeClasses(), isCurrentTrack && 'text-white'],
            isFullscreen && [
              getFontSizeClasses(),
              isCurrentTrack ? 'text-white' : 'text-foreground'
            ]
          )}>
          <div
            className={cn(isCompact && 'truncate', isFullscreen && 'truncate')}>
            {track.title}
          </div>
          {isFullscreen && (
            <p
              className={cn(
                'text-muted-foreground',
                getSubtitleFontSizeClasses()
              )}>
              Mix
            </p>
          )}
        </div>

        {/* Actions */}
        <div
          className={cn(
            'flex flex-shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100',
            isCompact && 'gap-1',
            isFullscreen && 'gap-2'
          )}>
          {showRemoveButton && isCompact && (
            <Button
              variant='ghost'
              size='sm'
              onClick={handleRemove}
              className='w-8 h-8 p-0 hover:text-destructive'>
              <X className='w-3 h-3' />
            </Button>
          )}

          {showContextMenu && isFullscreen && (
            <Button
              variant='ghost'
              size='icon'
              className='text-muted-foreground hover:text-foreground hover:bg-white/10'
              onClick={(e) => {
                e.stopPropagation()
                handleContextMenu(e)
              }}>
              <MoreHorizontal className='w-4 h-4' />
            </Button>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.isOpen && showContextMenu && (
        <div
          ref={menuRef}
          className='fixed z-50 py-1 border rounded-md shadow-lg min-w-48 bg-background border-border'
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}>
          <button
            type='button'
            onClick={handlePlayNow}
            className='flex items-center w-full gap-2 px-3 py-2 text-sm text-left transition-colors text-foreground hover:bg-muted'>
            <Play className='w-4 h-4' />
            Play now
          </button>

          <button
            type='button'
            onClick={handleAddToQueue}
            className='flex items-center w-full gap-2 px-3 py-2 text-sm text-left transition-colors text-foreground hover:bg-muted'>
            <Plus className='w-4 h-4' />
            Add to queue
          </button>

          <hr className='my-1 border-border' />

          <button
            type='button'
            onClick={handleAddToFavorites}
            className='flex items-center w-full gap-2 px-3 py-2 text-sm text-left transition-colors text-foreground hover:bg-muted'>
            <Heart className='w-4 h-4' />
            Add to favorites
          </button>

          <button
            type='button'
            onClick={handleShare}
            className='flex items-center w-full gap-2 px-3 py-2 text-sm text-left transition-colors text-foreground hover:bg-muted'>
            <Share2 className='w-4 h-4' />
            Share
          </button>
        </div>
      )}
    </>
  )
}
