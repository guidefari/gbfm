import { Artwork } from '@/components/common/Artwork'
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

const iconButtonClassName =
  'h-7 w-7 rounded-none border-0 bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-highlight'

export function ShowMetaBlock({ show }: ShowMetaBlockProps) {
  const hostNames = show.hosts?.map((h) => h.name).join(', ')

  return (
    <div className='min-w-0 font-mono'>
      <Artwork
        src={show.thumbnailUrl}
        alt={show.title}
        className='aspect-square w-full rounded-[2px]'
      />
      <h2 className='mt-3 text-lg font-bold tracking-tight text-foreground'>{show.title}</h2>
      {hostNames && <p className='mt-1 text-xs text-muted-foreground'>hosted by {hostNames}</p>}
      {show.description && (
        <p className='mt-3 border-t border-border/40 pt-3 text-xs leading-relaxed text-muted-foreground'>
          {show.description}
        </p>
      )}
      <div className='mt-4 flex items-center gap-1'>
        <SubscribeButton
          iconOnly
          showId={show.id}
          showTitle={show.title}
          className={iconButtonClassName}
        />
        <FavoriteButton
          contentType='show'
          contentId={show.id}
          contentTitle={show.title}
          variant='ghost'
          size='icon'
          className={iconButtonClassName}
        />
        <ShareButton
          type='show'
          slug={show.slug}
          variant='ghost'
          size='icon'
          className={iconButtonClassName}
        />
      </div>
      <div className='mt-1.5'>
        <ShowMetadataManager show={show} />
      </div>
    </div>
  )
}
