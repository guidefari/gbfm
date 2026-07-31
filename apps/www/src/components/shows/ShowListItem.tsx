import type { ShowWithHosts } from '@/lib/http'
import { cn } from '@/lib/utils'

interface ShowListItemProps {
  show: ShowWithHosts
  isSelected: boolean
  onSelect: () => void
}

export function ShowListItem({ show, isSelected, onSelect }: ShowListItemProps) {
  const hostNames = show.hosts?.map((h) => h.name).join(', ')

  return (
    <button
      type='button'
      onClick={onSelect}
      className={cn(
        'w-full rounded-sm border-l-2 px-2 py-1.5 text-left transition-colors',
        isSelected ? 'border-highlight bg-secondary/60' : 'border-transparent hover:bg-muted/40'
      )}>
      <p
        className={cn(
          'truncate text-sm font-semibold',
          isSelected ? 'text-highlight' : 'text-foreground'
        )}>
        {show.title}
      </p>
      {hostNames && !isSelected && (
        <p className='truncate text-xs text-muted-foreground'>{hostNames}</p>
      )}
    </button>
  )
}
