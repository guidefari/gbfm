import { Skeleton } from './skeleton'

const railKeys = Array.from({ length: 6 }, (_, index) => `show-rail-${index}`)
const episodeKeys = Array.from({ length: 5 }, (_, index) => `show-episode-${index}`)

function ShowListItemSkeleton() {
  return (
    <div className='flex items-center gap-3 border border-transparent p-2'>
      <Skeleton className='size-14 shrink-0 rounded-sm' />
      <div className='min-w-0 flex-1 space-y-2'>
        <Skeleton className='h-4 w-3/4' />
        <Skeleton className='h-3 w-1/2' />
      </div>
    </div>
  )
}

function EpisodeRowSkeleton() {
  return (
    <div className='flex items-center justify-between gap-4 border border-border p-4'>
      <div className='flex-1 space-y-2'>
        <Skeleton className='h-4 w-3/4' />
        <Skeleton className='h-3 w-1/2' />
      </div>
      <Skeleton className='h-8 w-24 shrink-0' />
    </div>
  )
}

export function ShowsSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:gap-8'>
      <aside className='hidden lg:block'>
        <nav className='space-y-2 pr-2'>
          {railKeys.map((key) => (
            <ShowListItemSkeleton key={key} />
          ))}
        </nav>
      </aside>

      <div className='lg:hidden'>
        <div className='flex gap-3 overflow-hidden'>
          {railKeys.slice(0, 4).map((key) => (
            <div key={key} className='flex w-24 shrink-0 flex-col gap-2'>
              <Skeleton className='aspect-square w-full rounded-sm' />
              <Skeleton className='h-3 w-3/4' />
            </div>
          ))}
        </div>
      </div>

      <main className='min-w-0'>
        <div className='flex items-center gap-4 pb-4'>
          <Skeleton className='size-20 shrink-0 rounded-sm' />
          <div className='min-w-0 flex-1 space-y-2'>
            <Skeleton className='h-7 w-1/2' />
            <Skeleton className='h-4 w-1/3' />
          </div>
        </div>
        <div className='space-y-4'>
          <Skeleton className='h-6 w-28' />
          <div className='space-y-3'>
            {episodeKeys.map((key) => (
              <EpisodeRowSkeleton key={key} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
