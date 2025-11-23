import type { SelectMix } from '@gbfm/vps/schemas'
import { Heart, Play, Plus, Share } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/components/ui/use-toast'
import { useAudioPlayerActions } from '@/store/audioPlayer'

interface TrackContextMenuProps {
  track: SelectMix
  children: React.ReactNode
  className?: string
}

interface ContextMenuState {
  isOpen: boolean
  x: number
  y: number
}

export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({
  track,
  children,
  className = ''
}) => {
  const { addToQueue, loadTrack } = useAudioPlayerActions()
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0
  })
  const menuRef = useRef<HTMLDivElement>(null)

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

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }))
  }, [])

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
  }, [contextMenu.isOpen, closeContextMenu])

  const handleAddToQueue = () => {
    addToQueue(track)
    closeContextMenu()
  }

  const handlePlayNow = () => {
    loadTrack(track.url, track.thumbnailUrl || '', track.title)
    closeContextMenu()
  }

  const handleAddToFavorites = () => {
    // TODO: Implement favorites functionality
    console.log('Add to favorites:', track.title)
    closeContextMenu()
  }

  const handleShare = async () => {
    const shareUrl = `https://vps.goosebumps.fm/mixes/${track.slug}`

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

    closeContextMenu()
  }

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Context menu wrapper requires mouse event handling */}
      <div
        onContextMenu={handleContextMenu}
        onKeyDown={(e) => {
          if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
            handleContextMenu(e as unknown as React.MouseEvent)
          }
        }}
        className={className}
        role='presentation'>
        {children}
      </div>

      {contextMenu.isOpen && (
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
            <Share className='w-4 h-4' />
            Share
          </button>
        </div>
      )}
    </>
  )
}
