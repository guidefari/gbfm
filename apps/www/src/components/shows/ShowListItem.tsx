import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { ShowWithHosts } from '@/lib/http'

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
      className={`w-full flex items-center gap-3 p-2 rounded-sm border text-left transition-all ${
        isSelected
          ? 'border-highlight bg-secondary ring-1 ring-highlight'
          : 'border-transparent hover:bg-muted/40 hover:border-border/60'
      }`}>
      <img
        src={show.thumbnailUrl || DEFAULT_IMAGE_URL}
        alt={show.title}
        className='w-16 h-16 object-cover rounded-sm border border-border bg-background shrink-0'
      />
      <div className='min-w-0'>
        <p className='text-sm font-semibold text-foreground line-clamp-2'>{show.title}</p>
        {hostNames && <p className='text-xs text-muted-foreground line-clamp-1'>{hostNames}</p>}
      </div>
    </button>
  )
}
