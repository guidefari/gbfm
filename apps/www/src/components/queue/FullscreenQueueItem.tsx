import React, { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import {
  MoreHorizontal,
  Play,
  Plus,
  Heart,
  Share,
  GripVertical
} from 'lucide-react'
import { useAudioPlayerActions } from '@/store/audioPlayer'
import { cn } from '@/lib/utils'
import type { SelectMix } from '@gbfm/vps/src/db/mix.schema'

interface FullscreenQueueItemProps {
  track: {
    queueId: string
    id: string
    title: string
    url: string
    thumbnailUrl: string
    addedAt: number
  }
  index: number
  isCurrentTrack: boolean
}

interface ContextMenuState {
  isOpen: boolean
  x: number
  y: number
}

export const FullscreenQueueItem: React.FC<FullscreenQueueItemProps> = ({
  track,
  index,
  isCurrentTrack
}) => {
  const { playFromQueue, addToQueue, loadTrack, removeFromQueue } =
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()

    const x = Math.min(e.clientX, window.innerWidth - 200) // Prevent menu from going off-screen
    const y = Math.min(e.clientY, window.innerHeight - 200) // Leave room for menu

    setContextMenu({
      isOpen: true,
      x,
      y
    })
  }

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }))
  }

  // Close menu when clicking outside
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
  }, [contextMenu.isOpen])

  const handlePlayNow = () => {
    loadTrack(track.url, track.thumbnailUrl, track.title)
    closeContextMenu()
  }

  const handleAddToQueue = () => {
    const mixData: SelectMix = {
      id: track.id,
      title: track.title,
      url: track.url,
      thumbnailUrl: track.thumbnailUrl,
      // Add other required SelectMix properties with defaults
      slug: '',
      description: '',
      tags: '',
      releasedAt: new Date(),
      updatedAt: new Date(),
      createdAt: new Date(),
      explicit: false,
      featured: false
    }
    addToQueue(mixData)
    closeContextMenu()
  }

  const handleAddToFavorites = () => {
    // TODO: Implement favorites functionality
    console.log('Add to favorites:', track.title)
    closeContextMenu()
  }

  const handleShare = () => {
    // TODO: Implement share functionality
    console.log('Share:', track.title)
    closeContextMenu()
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer',
          isCurrentTrack && 'bg-primary/10 border border-primary/20',
          isDragging && 'opacity-50 shadow-lg'
        )}
        onClick={handlePlay}
        onContextMenu={handleContextMenu}>
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className='flex-shrink-0 p-1 rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted cursor-grab active:cursor-grabbing'
          onClick={(e) => e.stopPropagation()}>
          <GripVertical className='w-4 h-4 text-muted-foreground' />
        </button>
        <div className='w-12 h-12 rounded-lg overflow-hidden flex-shrink-0'>
          <img
            src={track.thumbnailUrl || '/placeholder.svg'}
            alt={track.title}
            className='w-full h-full object-cover'
          />
        </div>
        <div className='flex-1 min-w-0'>
          <h3
            className={`font-medium truncate ${isCurrentTrack ? 'text-white' : 'text-foreground'}`}>
            {track.title}
          </h3>
          <p className='text-muted-foreground text-sm'>Mix</p>
        </div>
        <Button
          variant='ghost'
          size='icon'
          className='opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-white/10'
          onClick={(e) => {
            e.stopPropagation()
            handleContextMenu(e)
          }}>
          <MoreHorizontal className='w-4 h-4' />
        </Button>
      </div>

      {contextMenu.isOpen && (
        <div
          ref={menuRef}
          className='fixed z-50 py-1 rounded-md border shadow-lg min-w-48 bg-background border-border'
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}>
          <button
            onClick={handlePlayNow}
            className='flex gap-2 items-center px-3 py-2 w-full text-sm text-left transition-colors text-foreground hover:bg-muted'>
            <Play className='w-4 h-4' />
            Play now
          </button>

          <button
            onClick={handleAddToQueue}
            className='flex gap-2 items-center px-3 py-2 w-full text-sm text-left transition-colors text-foreground hover:bg-muted'>
            <Plus className='w-4 h-4' />
            Add to queue
          </button>

          <hr className='my-1 border-border' />

          <button
            onClick={handleAddToFavorites}
            className='flex gap-2 items-center px-3 py-2 w-full text-sm text-left transition-colors text-foreground hover:bg-muted'>
            <Heart className='w-4 h-4' />
            Add to favorites
          </button>

          <button
            onClick={handleShare}
            className='flex gap-2 items-center px-3 py-2 w-full text-sm text-left transition-colors text-foreground hover:bg-muted'>
            <Share className='w-4 h-4' />
            Share
          </button>
        </div>
      )}
    </>
  )
}
