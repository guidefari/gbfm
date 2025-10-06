import React, { useRef, useEffect, useState } from 'react'
import { Plus, Play, Heart, Share } from 'lucide-react'
import { useAudioPlayerActions } from '@/store/audioPlayer'
import type { SelectMix } from '@gbfm/vps/schemas'

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

  const handleShare = () => {
    // TODO: Implement share functionality
    console.log('Share:', track.title)
    closeContextMenu()
  }

  return (
    <>
      <div onContextMenu={handleContextMenu} className={className}>
        {children}
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
