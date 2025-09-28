import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CommandItem,
  CommandSection,
  CommandTile,
  CommandAction
} from './types'
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList
} from '@/components/ui/command'
import { CommandItem as UICommandItem } from '@/components/ui/command'

interface HierarchicalCommandProps {
  items: CommandItem[]
  onItemSelect: (item: CommandItem | CommandAction) => void
  isAuthenticated: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  className?: string
}

export function HierarchicalCommand({
  items,
  onItemSelect,
  isAuthenticated,
  searchValue,
  onSearchChange,
  className
}: HierarchicalCommandProps) {
  const [activeSection, setActiveSection] = useState<CommandSection | null>(
    null
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter items based on authentication and search
  const filteredItems = items
    .filter((item) => !item.requiresAuth || isAuthenticated)
    .filter((item) => {
      if (!searchValue.trim()) return true
      return item.label.toLowerCase().includes(searchValue.toLowerCase())
    })

  // Filter section items if in a section
  const filteredSectionItems =
    activeSection?.items.filter(
      (item) =>
        !searchValue.trim() ||
        item.label.toLowerCase().includes(searchValue.toLowerCase())
    ) || []

  const currentItems = activeSection ? filteredSectionItems : filteredItems
  const isInSection = Boolean(activeSection)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!currentItems.length) return

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : currentItems.length - 1
          )
          break

        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev < currentItems.length - 1 ? prev + 1 : 0
          )
          break

        case 'Enter':
        case ' ':
          e.preventDefault()
          if (currentItems[selectedIndex]) {
            handleItemSelect(currentItems[selectedIndex])
          }
          break

        case 'Escape':
          e.preventDefault()
          if (isInSection) {
            setActiveSection(null)
            setSelectedIndex(0)
          }
          break

        case 'Backspace':
          if (!searchValue && isInSection) {
            e.preventDefault()
            setActiveSection(null)
            setSelectedIndex(0)
          }
          break
      }
    },
    [selectedIndex, currentItems, searchValue, isInSection]
  )

  const handleItemSelect = (item: CommandItem | CommandAction) => {
    if ('type' in item && item.type === 'section') {
      // Open section
      setActiveSection(item as CommandSection)
      setSelectedIndex(0)
      onSearchChange('') // Clear search when entering section
    } else {
      // Execute action
      onItemSelect(item)
    }
  }

  const handleBackClick = () => {
    setActiveSection(null)
    setSelectedIndex(0)
    onSearchChange('')
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [currentItems.length, searchValue])

  // Reset when search is cleared and we're not in a section
  useEffect(() => {
    if (!searchValue && !isInSection) {
      setSelectedIndex(0)
    }
  }, [searchValue, isInSection])

  // Render as grid when showing main tiles (both filtered and unfiltered)
  if (!isInSection) {
    return (
      <div
        ref={containerRef}
        className={cn('min-h-[320px] p-4', className)} // Fixed minimum height
      >
        <div className='grid grid-cols-4 gap-4'>
          {filteredItems.map((item, index) => {
            const Icon = item.icon
            const isSelected = index === selectedIndex

            return (
              <button
                key={item.id}
                className={cn(
                  'flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all duration-200',
                  'hover:bg-accent hover:border-accent-foreground/20 focus:outline-none',
                  isSelected
                    ? 'bg-accent border-accent-foreground/40 shadow-lg'
                    : 'bg-background border-border hover:border-accent-foreground/20'
                )}
                onClick={() => handleItemSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}>
                <Icon
                  className={cn(
                    'w-8 h-8 mb-2 transition-colors',
                    isSelected
                      ? 'text-accent-foreground'
                      : 'text-muted-foreground'
                  )}
                />
                <span
                  className={cn(
                    'text-sm font-medium transition-colors text-center',
                    isSelected
                      ? 'text-accent-foreground'
                      : 'text-muted-foreground'
                  )}>
                  {item.label}
                </span>
                {item.shortcut && (
                  <span
                    className={cn(
                      'text-xs mt-1 px-2 py-1 rounded bg-muted transition-colors',
                      isSelected
                        ? 'text-accent-foreground/80'
                        : 'text-muted-foreground/60'
                    )}>
                    {item.shortcut}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {searchValue && filteredItems.length === 0 && (
          <div className='flex items-center justify-center h-32 text-muted-foreground'>
            <div className='text-center'>
              <Search className='w-8 h-8 mx-auto mb-2 opacity-50' />
              <p>No tiles found for "{searchValue}"</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render as list when searching or in a section
  return (
    <CommandList className={className}>
      <CommandEmpty>No results found.</CommandEmpty>

      {isInSection && (
        <div className='flex items-center px-3 py-2 border-b'>
          <button
            onClick={handleBackClick}
            className='flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors'>
            <ArrowLeft className='w-4 h-4 mr-2' />
            Back to main
          </button>
          <span className='ml-auto text-sm font-medium'>
            {activeSection?.label}
          </span>
        </div>
      )}

      <CommandGroup
        heading={
          isInSection
            ? activeSection?.label
            : searchValue
              ? 'Search Results'
              : 'All Items'
        }>
        {currentItems.map((item, index) => {
          const Icon = 'icon' in item ? item.icon : undefined
          const isSelected = index === selectedIndex

          return (
            <UICommandItem
              key={item.id}
              onSelect={() => handleItemSelect(item)}
              className={cn(isSelected && 'bg-accent')}
              onMouseEnter={() => setSelectedIndex(index)}>
              {Icon && <Icon className='w-4 h-4' />}
              <span>{item.label}</span>
              {'shortcut' in item && item.shortcut && (
                <span className='ml-auto text-xs text-muted-foreground'>
                  {item.shortcut}
                </span>
              )}
            </UICommandItem>
          )
        })}
      </CommandGroup>
    </CommandList>
  )
}
