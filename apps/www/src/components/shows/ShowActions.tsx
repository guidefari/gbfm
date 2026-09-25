import { QueryClientProvider } from '@tanstack/react-query'
import { FavoriteButton } from '@/components/FavoriteButton'
import { ShareButton } from '@/components/ShareButton'
import { queryClient } from '@/lib/query-client'
import { ShowMetadataManager } from '@/routes/shows/_components/-ShowMetadataManager'
import { SubscribeButton } from './SubscribeButton'

type Show = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly description: string | null
  readonly thumbnailUrl: string | null
  readonly bannerImageUrl: string | null
  readonly content: string
  readonly draft: boolean
  readonly tags: readonly string[] | null
}

const iconButtonClassName =
  'h-7 w-7 rounded-none border-0 bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-highlight'

export function ShowActions({ show }: { readonly show: Show }) {
  return (
    <QueryClientProvider client={queryClient}>
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
        <ShowMetadataManager show={{ ...show, tags: show.tags ? [...show.tags] : null }} />
      </div>
    </QueryClientProvider>
  )
}
