import { Artwork } from '@/components/common/Artwork'
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
        'flex w-full items-center gap-2 border-b border-border/40 px-1 py-1.5 text-left transition-colors last:border-b-0',
        isSelected ? 'text-highlight' : 'text-foreground/70 hover:text-foreground'
      )}>
      <Artwork src={show.thumbnailUrl} alt={show.title} className='size-8 shrink-0' />
      <span className='min-w-0 flex-1'>
        <span className='block truncate'>{show.title}</span>
        {hostNames && (
          <span className='block truncate text-xs text-muted-foreground'>{hostNames}</span>
        )}
      </span>
    </button>
  )
}
