import { createFileRoute, Link } from '@tanstack/react-router'
import { Radio, Tag, X } from 'lucide-react'
import { useMemo } from 'react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { z } from 'zod'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { MixesListSkeleton, MixesSkeleton } from '@/components/MixesSkeleton'
import { MixMenu } from '@/components/MixMenu'
import { TrackContextMenu } from '@/components/TrackContextMenu'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAudioByType } from '@/lib/http'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

const searchSchema = z.object({
  tag: z.string().optional()
})

export const Route = createFileRoute('/mixes/')({
  component: MixesListPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.mixes)
  })
})

function MixesListPage() {
  const { tag } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAudioByType('mix', tag)
  const { data: allMixesForTags } = useAudioByType('mix')
  const { mixesSorting } = useUIStore()
  const { isPlaying, nowPlayingContext } = useAudioPlayerState()
  const { loadTrack } = useAudioPlayerActions()

  const allTags = useMemo(() => {
    if (!allMixesForTags) return []
    const tagSet = new Set<string>()
    allMixesForTags.forEach((mix) => {
      mix.tags?.forEach((t) => {
        tagSet.add(t)
      })
    })
    return Array.from(tagSet).sort()
  }, [allMixesForTags])

  const handleTagChange = (newTag: string) => {
    navigate({
      search: newTag === 'all' ? {} : { tag: newTag }
    })
  }

  const sortedData = useMemo(() => {
    if (!data) return []

    const sorted = [...data].sort((a, b) => {
      if (mixesSorting.sortBy === 'date') {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return mixesSorting.sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      } else {
        const titleA = a.title.toLowerCase()
        const titleB = b.title.toLowerCase()
        if (mixesSorting.sortOrder === 'asc') {
          return titleA.localeCompare(titleB)
        } else {
          return titleB.localeCompare(titleA)
        }
      }
    })

    return sorted
  }, [data, mixesSorting.sortBy, mixesSorting.sortOrder])

  if (isPending && !tag) {
    return <MixesSkeleton />
  }

  return (
    <div className='max-w-3xl mx-auto px-4 py-8'>
      <div className='flex flex-row items-baseline justify-between gap-4 mb-8 border-b pb-4 border-border/40'>
        <div className='flex items-baseline gap-6'>
          <h1 className='text-2xl font-black tracking-tight'>Mixes</h1>
          <Link
            to='/shows'
            className='flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group'>
            <Radio className='w-4 h-4' />
            Radio Shows
            <span className='absolute -bottom-[17px] left-0 right-0 h-0.5 bg-foreground scale-x-0 group-hover:scale-x-100 transition-transform origin-left' />
          </Link>
        </div>
        {allTags.length > 0 && (
          <Select value={tag || 'all'} onValueChange={handleTagChange}>
            <SelectTrigger
              className='w-auto min-w-[120px] h-9 text-xs font-semibold uppercase tracking-wider bg-transparent border-none shadow-none hover:bg-muted/50 transition-colors px-3'
              data-testid='tag-filter-select'>
              <div className='flex items-center gap-2'>
                <Tag className='w-3 h-3' />
                <SelectValue placeholder='Filter' />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all' data-testid='tag-option-all'>
                All tags
              </SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t} value={t} data-testid={`tag-option-${t}`}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {tag && (
        <div className='flex items-center gap-2 mb-3'>
          <Badge
            variant='secondary'
            className='gap-1'
            data-testid='active-tag-badge'>
            <Tag className='w-3 h-3' />
            {tag}
            <button
              type='button'
              onClick={() => navigate({ search: {} })}
              className='ml-1 hover:text-foreground'
              data-testid='remove-tag-filter'
              aria-label='Remove tag filter'>
              <X className='w-3 h-3' />
            </button>
          </Badge>
        </div>
      )}
      <div className='grid gap-2'>
        {isPending && tag ? (
          <MixesListSkeleton />
        ) : (
          sortedData?.map((mix) => {
            const isActive = nowPlayingContext?.title === mix.title
            return (
              <TrackContextMenu key={mix.id} track={mix}>
                <article
                  data-testid='mix-item'
                  className={cn(
                    'flex gap-3 items-start p-2 transition-all duration-300 cursor-pointer hover:bg-muted/50 rounded-sm group',
                    isActive && 'ring-1 ring-border bg-accent/5 shadow-sm'
                  )}>
                  <button
                    type='button'
                    className='relative flex-shrink-0 focus:outline-none'
                    onClick={() =>
                      loadTrack(
                        mix.url,
                        mix.thumbnailUrl || DEFAULT_IMAGE_URL,
                        mix.title,
                        mix.id,
                        mix.creators,
                        mix.slug
                      )
                    }>
                    <img
                      src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
                      alt={mix.title}
                      className='object-cover transition-transform duration-300 border rounded-sm w-16 h-16 sm:w-20 sm:h-20 border-border bg-background group-hover:scale-105'
                    />
                    <span
                      className={cn(
                        'absolute inset-0 flex items-center justify-center transition-all duration-300 rounded-sm bg-black/50',
                        isActive
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'
                      )}>
                      {isActive && isPlaying ? (
                        <GiPauseButton className='text-2xl text-white drop-shadow' />
                      ) : (
                        <GiPlayButton className='text-2xl text-white drop-shadow' />
                      )}
                    </span>
                  </button>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between gap-2'>
                      <Link
                        to='/mixes/$mixId'
                        params={{ mixId: mix.slug }}
                        className='flex-1 block font-bold leading-tight line-clamp-2 text-foreground hover:underline decoration-foreground/30 underline-offset-4'>
                        {mix.title}
                      </Link>
                      <MixMenu mix={mix} />
                    </div>
                    {mix.description && (
                      <div className='mt-1 text-sm leading-relaxed text-foreground/60 line-clamp-2'>
                        {mix.description}
                      </div>
                    )}
                  </div>
                </article>
              </TrackContextMenu>
            )
          })
        )}

        <LoadMoreTrigger
          onLoadMore={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      </div>
    </div>
  )
}
