import { Skeleton } from './skeleton'

const railKeys = Array.from({ length: 6 }, (_, index) => `show-rail-${index}`)
const episodeKeys = Array.from({ length: 5 }, (_, index) => `show-episode-${index}`)

function ShowListItemSkeleton() {
  return (
    <div className='space-y-1.5 border-l-2 border-transparent px-2 py-1.5'>
      <Skeleton className='h-4 w-3/4' />
      <Skeleton className='h-3 w-1/2' />
    </div>
  )
}

function EpisodeRowSkeleton() {
  return (
    <div className='flex items-center gap-3 border-b border-border/40 px-2 py-3'>
      <Skeleton className='size-9 shrink-0' />
      <div className='min-w-0 flex-1 space-y-2'>
        <Skeleton className='h-4 w-3/4' />
        <Skeleton className='h-3 w-1/2' />
      </div>
    </div>
  )
}

export function ShowsSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8'>
      <aside className='hidden lg:block'>
        <div className='sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-1'>
          <div className='space-y-2'>
            <Skeleton className='h-6 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
            <Skeleton className='h-3 w-full' />
            <div className='flex gap-px pt-1'>
              <Skeleton className='h-9 w-9' />
              <Skeleton className='h-9 w-9' />
              <Skeleton className='h-9 w-9' />
            </div>
          </div>
          <div className='my-4 border-t border-border/40' />
          <nav className='space-y-2'>
            {railKeys.map((key) => (
              <ShowListItemSkeleton key={key} />
            ))}
          </nav>
        </div>
      </aside>

      <div className='lg:hidden'>
        <div className='flex gap-2 overflow-hidden'>
          {railKeys.slice(0, 4).map((key) => (
            <Skeleton key={key} className='h-8 w-24 shrink-0 rounded-sm' />
          ))}
        </div>
      </div>

      <main className='min-w-0'>
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
