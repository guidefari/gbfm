import {
  CommandEmpty,
  CommandGroup,
  CommandList,
  CommandItem as UICommandItem
} from '@gbfm/ui'
import { Search } from 'lucide-react'
import type { RefObject } from 'react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { cn } from '@/lib/utils'
import type { CommandAction, CommandItem, CommandSection } from './types'

interface HierarchicalCommandProps {
  items: CommandItem[]
  onItemSelect: (item: CommandItem | CommandAction) => void
  isAuthenticated: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  onSectionChange?: (isInSection: boolean) => void
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  className?: string
}

export function HierarchicalCommand({
  items,
  onItemSelect,
  isAuthenticated,
  searchValue,
  onSearchChange,
  onSectionChange,
  scrollContainerRef,
  className
}: HierarchicalCommandProps) {
  const [activeSection, setActiveSection] = useState<CommandSection | null>(
    null
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const itemRefs = useRef<Array<HTMLElement | null>>([])

  // Filter items based on authentication and search
  const filteredItems = items
    .filter((item) => Boolean(item))
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

  const handleItemSelect = useCallback(
    (item: CommandItem | CommandAction) => {
      if ('type' in item && item.type === 'section') {
        // Open section
        setActiveSection(item as CommandSection)
        setSelectedIndex(0)
        onSearchChange('') // Clear search when entering section
        onSectionChange?.(true)
      } else {
        // Execute action
        onItemSelect(item)
      }
    },
    [onItemSelect, onSearchChange, onSectionChange]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!currentItems.length) return

      const gridCols = 4

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          if (!isInSection) {
            setSelectedIndex((prev) => {
              const newIndex = prev - gridCols
              return newIndex >= 0 ? newIndex : prev
            })
          } else {
            setSelectedIndex((prev) =>
              prev > 0 ? prev - 1 : currentItems.length - 1
            )
          }
          break

        case 'ArrowDown':
          e.preventDefault()
          if (!isInSection) {
            setSelectedIndex((prev) => {
              const newIndex = prev + gridCols
              return newIndex < currentItems.length ? newIndex : prev
            })
          } else {
            setSelectedIndex((prev) =>
              prev < currentItems.length - 1 ? prev + 1 : 0
            )
          }
          break

        case 'ArrowLeft':
          e.preventDefault()
          if (!isInSection) {
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
          }
          break

        case 'ArrowRight':
          e.preventDefault()
          if (!isInSection) {
            setSelectedIndex((prev) =>
              prev < currentItems.length - 1 ? prev + 1 : prev
            )
          }
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
            onSectionChange?.(false)
          }
          break

        case 'Backspace':
          if (!searchValue && isInSection) {
            e.preventDefault()
            setActiveSection(null)
            setSelectedIndex(0)
            onSectionChange?.(false)
          }
          break
      }
    },
    [
      selectedIndex,
      currentItems,
      searchValue,
      isInSection,
      handleItemSelect,
      onSectionChange
    ]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [])

  // Reset when search is cleared and we're not in a section
  useEffect(() => {
    if (!searchValue && !isInSection) {
      setSelectedIndex(0)
    }
  }, [searchValue, isInSection])

  useLayoutEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex]

    if (!selectedItem) {
      return
    }

    const scrollContainer = scrollContainerRef?.current

    if (!scrollContainer || isInSection) {
      selectedItem.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      })
      return
    }

    const padding = 16
    const containerRect = scrollContainer.getBoundingClientRect()
    const itemRect = selectedItem.getBoundingClientRect()
    const topOverflow = itemRect.top - containerRect.top - padding
    const bottomOverflow = itemRect.bottom - containerRect.bottom + padding

    if (topOverflow < 0) {
      scrollContainer.scrollBy({ top: topOverflow })
    } else if (bottomOverflow > 0) {
      scrollContainer.scrollBy({ top: bottomOverflow })
    }
  }, [isInSection, scrollContainerRef, selectedIndex])

  // Render as grid when showing main tiles (both filtered and unfiltered)
  if (!isInSection) {
    return (
      <div
        className={cn('min-h-[320px] p-4', className)} // Fixed minimum height
      >
        <div className='grid grid-cols-4 gap-4'>
          {filteredItems.map((item, index) => {
            const Icon = item.icon
            const isSelected = index === selectedIndex

            return (
              <button
                type='button'
                key={item.id}
                ref={(el) => {
                  itemRefs.current[index] = el
                }}
                className={cn(
                  'scroll-m-4',
                  'flex flex-col items-center justify-center p-6 rounded-sm border-2',
                  'hover:bg-accent hover:border-accent-foreground/20 focus:outline-none',
                  isSelected
                    ? 'border-background bg-accent shadow-lg'
                    : 'border-border hover:border-accent-foreground/20'
                )}
                onClick={() => handleItemSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}>
                <Icon
                  className={cn(
                    'w-8 h-8 mb-2',
                    isSelected
                      ? 'text-accent-foreground'
                      : 'text-muted-foreground'
                  )}
                />
                <span
                  className={cn(
                    'text-sm font-medium text-center',
                    isSelected
                      ? 'text-accent-foreground'
                      : 'text-muted-foreground'
                  )}>
                  {item.label}
                </span>
                {item.shortcut && (
                  <span
                    className={cn(
                      'text-xs mt-1 px-2 py-1 rounded bg-muted',
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
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              onSelect={() => handleItemSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                'scroll-m-4',
                isSelected ? 'bg-accent text-accent-foreground' : ''
              )}>
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
