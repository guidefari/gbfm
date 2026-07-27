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
      aria-pressed={isSelected}
      className={`w-full min-h-11 flex items-center gap-2 p-2 rounded-sm border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        isSelected
          ? 'border-highlight bg-secondary ring-1 ring-highlight'
          : 'border-transparent hover:bg-muted/40 hover:border-border/60'
      }`}>
      <img
        src={show.thumbnailUrl || DEFAULT_IMAGE_URL}
        alt={`Artwork for ${show.title}`}
        width={64}
        height={64}
        loading='lazy'
        sizes='64px'
        className='w-14 aspect-square object-cover rounded-sm border border-border bg-background shrink-0 lg:w-16'
      />
      <div className='min-w-0'>
        <p className='text-sm font-semibold text-foreground line-clamp-2'>{show.title}</p>
        {hostNames && <p className='text-xs text-muted-foreground line-clamp-1'>{hostNames}</p>}
      </div>
    </button>
  )
}
