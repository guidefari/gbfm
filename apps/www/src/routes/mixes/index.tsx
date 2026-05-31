import {
  Badge,
  MixesListSkeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@gbfm/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Radio, Tag, X } from 'lucide-react'
import { useMemo } from 'react'
import { z } from 'zod'
import { LoadMoreTrigger } from '@/components/LoadMoreTrigger'
import { MixListItem } from '@/components/MixListItem'
import { MixMenu } from '@/components/MixMenu'
import { MixTimeline, MixTimelineItem } from '@/components/MixTimeline'
import { QueryError } from '@/components/QueryError'
import { TrackContextMenu } from '@/components/TrackContextMenu'
import { useAudioByType, useAudioTags } from '@/lib/http'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'
import { useUIStore } from '@/store'

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
  const {
    data,
    error,
    isPending,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useAudioByType('mix', { tag })
  const { data: allTags } = useAudioTags('mix')
  const { mixesSorting } = useUIStore()

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

  if (error) {
    return (
      <div className='max-w-3xl mx-auto px-4 py-8'>
        <QueryError error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div className='max-w-3xl mx-auto px-4 py-8'>
      <div className='flex flex-row items-baseline justify-between gap-4 mb-8 border-b pb-4 border-border/40'>
        <div className='flex flex-col gap-1'>
          <div className='flex items-baseline gap-6'>
            <h1 className='text-2xl font-black tracking-tight'>Mixes</h1>
            <Link
              to='/shows'
              className='flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group'>
              <Radio className='w-4 h-4' />
              Radio Shows
              <span className='absolute bottom-[-17px] left-0 right-0 h-0.5 bg-foreground scale-x-0 group-hover:scale-x-100 transition-transform origin-left' />
            </Link>
          </div>
          <p className='text-sm text-muted-foreground'>
            Every mix in one feed. For curated series, browse{' '}
            <Link to='/shows' className='underline hover:text-foreground'>
              radio shows
            </Link>
            .
          </p>
        </div>
        {allTags.length > 0 ? (
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
        ) : (
          <div className='h-9 min-w-[120px] px-3' aria-hidden='true' />
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
      {isPending && !data?.length ? (
        <MixesListSkeleton />
      ) : (
        <MixTimeline>
          {sortedData?.map((mix) => (
            <MixTimelineItem key={mix.id} mix={mix}>
              <TrackContextMenu track={mix}>
                <MixListItem mix={mix} actions={<MixMenu mix={mix} />} />
              </TrackContextMenu>
            </MixTimelineItem>
          ))}
          <LoadMoreTrigger
            onLoadMore={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
          />
        </MixTimeline>
      )}
    </div>
  )
}
