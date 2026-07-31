import { FavoriteButton } from '@/components/FavoriteButton'
import { ShareButton } from '@/components/ShareButton'
import { ShowMetadataManager } from '@/routes/shows/_components/-ShowMetadataManager'
import { SubscribeButton } from './SubscribeButton'

export type ShowMeta = {
  id: string
  slug: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  bannerImageUrl: string | null
  content: string
  draft: boolean
  tags: string[] | null
  hosts?: Array<{ id: string; name: string }>
}

interface ShowMetaBlockProps {
  show: ShowMeta
}

export function ShowMetaBlock({ show }: ShowMetaBlockProps) {
  const hostNames = show.hosts?.map((h) => h.name).join(', ')

  return (
    <div className='min-w-0'>
      <h2 className='text-xl font-black tracking-tight text-foreground'>{show.title}</h2>
      {hostNames && <p className='mt-1 text-xs text-muted-foreground'>Hosted by {hostNames}</p>}
      {show.description && (
        <p className='mt-3 hidden text-xs leading-relaxed text-muted-foreground line-clamp-4 lg:block'>
          {show.description}
        </p>
      )}
      <div className='mt-4 flex items-center gap-px overflow-hidden rounded-sm border border-border/70'>
        <SubscribeButton
          iconOnly
          showId={show.id}
          showTitle={show.title}
          className='border-r border-border/70'
        />
        <FavoriteButton
          contentType='show'
          contentId={show.id}
          contentTitle={show.title}
          variant='ghost'
          size='icon'
          className='h-9 w-9 rounded-none'
        />
        <ShareButton
          type='show'
          slug={show.slug}
          variant='ghost'
          size='icon'
          className='h-9 w-9 rounded-none'
        />
      </div>
      <ShowMetadataManager show={show} />
    </div>
  )
}
