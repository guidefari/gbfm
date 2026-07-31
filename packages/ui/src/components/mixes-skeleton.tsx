import { Skeleton } from './skeleton'

export function MixesListSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }, (_, index) => `skeleton-${index}`).map((id, index) => (
        <div
          key={id}
          className='flex items-start gap-3 border-b border-border/50 py-3 last:border-b-0'>
          <Skeleton className='h-3 w-8 shrink-0 mt-1' />

          <Skeleton className='aspect-square w-12 shrink-0 rounded-[2px] sm:w-14' />

          <div className='flex min-w-0 flex-1 flex-col gap-1'>
            <div className='flex min-w-0 items-center gap-2'>
              <Skeleton className='h-6 w-5 shrink-0 rounded-sm' />
              <Skeleton className={index % 3 === 0 ? 'h-6 w-3/5' : 'h-6 w-2/5'} />
            </div>

            <div className='flex items-center gap-2'>
              <Skeleton className='h-3 w-24' />
              <Skeleton className='h-3 w-16' />
              {index % 2 === 1 && <Skeleton className='h-3 w-12' />}
            </div>
          </div>

          <Skeleton className='h-8 w-8 shrink-0 rounded-sm' />
        </div>
      ))}
    </div>
  )
}

export function MixesSkeleton() {
  return (
    <div className='max-w-3xl mx-auto px-4 py-8'>
      <div className='mb-8 flex flex-col gap-4 border-b border-border/40 pb-4 sm:flex-row sm:items-baseline sm:justify-between'>
        <div className='flex items-baseline gap-6'>
          <Skeleton className='h-8 w-24' />
          <div className='flex items-center gap-2'>
            <Skeleton className='h-4 w-4 rounded-full' />
            <Skeleton className='h-5 w-28' />
          </div>
        </div>
        <Skeleton className='h-9 w-[140px]' />
      </div>
      <MixesListSkeleton />
    </div>
  )
}
