import { Link } from '@tanstack/react-router'
import { Artwork } from '@/components/common/Artwork'
import type { ShowWithHosts } from '@/lib/http'

interface ShowCardProps {
  show: ShowWithHosts
  isSelected?: boolean
  onSelect?: () => void
}

export function ShowCard({ show, isSelected, onSelect }: ShowCardProps) {
  const hostNames = show.hosts?.map((h) => h.name).join(', ')

  if (!onSelect) {
    return (
      <Link
        to='/$slug'
        params={{ slug: show.slug }}
        className='flex flex-col gap-2 transition-transform group hover:scale-105'>
        <ShowArtwork thumbnailUrl={show.thumbnailUrl} title={show.title} />
        <ShowInfo title={show.title} hostNames={hostNames} />
      </Link>
    )
  }

  return (
    <button
      type='button'
      onClick={onSelect}
      className={`text-left flex flex-col gap-2 transition-all group ${
        isSelected ? 'scale-105' : 'hover:scale-105'
      }`}>
      <Artwork
        src={show.thumbnailUrl}
        alt={show.title}
        hover='fade'
        className={`w-full shadow-sm ${isSelected ? 'ring-2 ring-highlight' : ''}`}
      />
      <ShowInfo title={show.title} hostNames={hostNames} />
    </button>
  )
}

function ShowArtwork({ thumbnailUrl, title }: { thumbnailUrl: string | null; title: string }) {
  return <Artwork src={thumbnailUrl} alt={title} hover='fade' className='w-full shadow-sm' />
}

function ShowInfo({ title, hostNames }: { title: string; hostNames?: string }) {
  return (
    <div className='flex flex-col gap-1'>
      <span className='text-sm font-semibold leading-tight transition-colors text-foreground group-hover:text-highlight line-clamp-2'>
        {title}
      </span>
      {hostNames && <p className='text-xs p-0 text-muted-foreground line-clamp-1'>{hostNames}</p>}
    </div>
  )
}
