import type { ShowWithHosts } from '@/lib/http'
import { cn } from '@/lib/utils'

interface ShowSwitcherRailProps {
  shows: ShowWithHosts[]
  selectedShowId?: string
  onSelect: (show: ShowWithHosts) => void
}

export function ShowSwitcherRail({ shows, selectedShowId, onSelect }: ShowSwitcherRailProps) {
  return (
    <nav className='no-scrollbar flex gap-2 overflow-x-auto' aria-label='Show switcher'>
      {shows.map((show) => {
        const isSelected = selectedShowId === show.id
        return (
          <button
            key={show.id}
            type='button'
            onClick={() => onSelect(show)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors',
              isSelected
                ? 'border-highlight bg-secondary text-highlight'
                : 'border-border text-foreground/70 hover:bg-muted/40'
            )}>
            {show.title}
          </button>
        )
      })}
    </nav>
  )
}
