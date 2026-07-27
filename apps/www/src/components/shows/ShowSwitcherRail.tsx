import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { ShowWithHosts } from '@/lib/http'
import { cn } from '@/lib/utils'

interface ShowSwitcherRailProps {
  shows: ShowWithHosts[]
  selectedShowId?: string
  onSelect: (show: ShowWithHosts) => void
}

export function ShowSwitcherRail({ shows, selectedShowId, onSelect }: ShowSwitcherRailProps) {
  return (
    <nav
      className='flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 no-scrollbar'
      aria-label='Show switcher'>
      {shows.map((show) => (
        <ShowSwitcherCard
          key={show.id}
          show={show}
          isSelected={selectedShowId === show.id}
          onSelect={() => onSelect(show)}
        />
      ))}
    </nav>
  )
}

function ShowSwitcherCard({
  show,
  isSelected,
  onSelect
}: {
  show: ShowWithHosts
  isSelected: boolean
  onSelect: () => void
}) {
  const hostNames = show.hosts?.map((h) => h.name).join(', ')

  return (
    <button
      type='button'
      onClick={onSelect}
      className={cn(
        'shrink-0 snap-start w-24 flex flex-col gap-1.5 text-left transition-opacity',
        !isSelected && 'opacity-60 hover:opacity-90'
      )}>
      <div
        className={cn(
          'aspect-square w-full overflow-hidden border rounded-sm bg-background',
          isSelected ? 'border-highlight ring-1 ring-highlight' : 'border-border'
        )}>
        <img
          src={show.thumbnailUrl || DEFAULT_IMAGE_URL}
          alt={show.title}
          className='object-cover w-full h-full'
        />
      </div>
      <p
        className={cn(
          'text-[11px] font-semibold leading-tight line-clamp-2',
          isSelected ? 'text-highlight' : 'text-foreground/70'
        )}>
        {show.title}
      </p>
      {hostNames && <p className='text-[10px] text-muted-foreground line-clamp-1'>{hostNames}</p>}
    </button>
  )
}
