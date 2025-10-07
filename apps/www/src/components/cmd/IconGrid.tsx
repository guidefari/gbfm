import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Home,
  Headphones,
  Music,
  Settings,
  Upload,
  FileText,
  Mic,
  BookOpen,
  LockKeyhole
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface IconTile {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  onSelect: () => void
  shortcut?: string
  requiresAuth?: boolean
}

interface IconGridProps {
  tiles: IconTile[]
  onTileSelect: (tile: IconTile) => void
  isAuthenticated: boolean
  className?: string
}

export function IconGrid({
  tiles,
  onTileSelect,
  isAuthenticated,
  className
}: IconGridProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)

  // Filter tiles based on authentication
  const availableTiles = tiles.filter(
    (tile) => !tile.requiresAuth || isAuthenticated
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!availableTiles.length) return

      const cols = 4 // Number of columns in grid
      const currentRow = Math.floor(selectedIndex / cols)
      const currentCol = selectedIndex % cols
      const maxRow = Math.floor((availableTiles.length - 1) / cols)

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          if (currentRow > 0) {
            setSelectedIndex(selectedIndex - cols)
          } else {
            // Go to bottom row, same column
            const newIndex = Math.min(
              maxRow * cols + currentCol,
              availableTiles.length - 1
            )
            setSelectedIndex(newIndex)
          }
          break

        case 'ArrowDown':
          e.preventDefault()
          if (currentRow < maxRow) {
            const newIndex = Math.min(
              selectedIndex + cols,
              availableTiles.length - 1
            )
            setSelectedIndex(newIndex)
          } else {
            // Go to top row, same column
            setSelectedIndex(currentCol)
          }
          break

        case 'ArrowLeft':
          e.preventDefault()
          if (currentCol > 0) {
            setSelectedIndex(selectedIndex - 1)
          } else {
            // Go to end of current row or previous row
            const rowStart = currentRow * cols
            const rowEnd = Math.min(
              rowStart + cols - 1,
              availableTiles.length - 1
            )
            setSelectedIndex(rowEnd)
          }
          break

        case 'ArrowRight':
          e.preventDefault()
          const rowEnd = Math.min(
            (currentRow + 1) * cols - 1,
            availableTiles.length - 1
          )
          if (selectedIndex < rowEnd) {
            setSelectedIndex(selectedIndex + 1)
          } else {
            // Go to start of current row
            setSelectedIndex(currentRow * cols)
          }
          break

        case 'Enter':
        case ' ':
          e.preventDefault()
          if (availableTiles[selectedIndex]) {
            onTileSelect(availableTiles[selectedIndex])
          }
          break
      }
    },
    [selectedIndex, availableTiles, onTileSelect]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Reset selection when tiles change
  useEffect(() => {
    setSelectedIndex(0)
  }, [availableTiles.length])

  return (
    <div ref={gridRef} className={cn('grid grid-cols-4 gap-4 p-4', className)}>
      {availableTiles.map((tile, index) => {
        const Icon = tile.icon
        const isSelected = index === selectedIndex

        return (
          <button
            key={tile.id}
            className={cn(
              'flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all duration-200',
              'hover:bg-accent hover:border-accent-foreground/20 focus:outline-none',
              isSelected
                ? 'bg-accent border-accent-foreground/40 shadow-lg'
                : 'bg-background border-border hover:border-accent-foreground/20'
            )}
            onClick={() => onTileSelect(tile)}
            onMouseEnter={() => setSelectedIndex(index)}>
            <Icon
              className={cn(
                'w-8 h-8 mb-2 transition-colors',
                isSelected ? 'text-accent-foreground' : 'text-muted-foreground'
              )}
            />
            <span
              className={cn(
                'text-sm font-medium transition-colors',
                isSelected ? 'text-accent-foreground' : 'text-muted-foreground'
              )}>
              {tile.label}
            </span>
            {tile.shortcut && (
              <span
                className={cn(
                  'text-xs mt-1 px-2 py-1 rounded bg-muted transition-colors',
                  isSelected
                    ? 'text-accent-foreground/80'
                    : 'text-muted-foreground/60'
                )}>
                {tile.shortcut}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
