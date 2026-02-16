import { Skeleton } from '@/components/ui/skeleton'

export function MixesListSkeleton() {
  return (
    <div className='grid gap-3'>
      {Array.from({ length: 8 }, (_, index) => `skeleton-${index}`).map(
        (id) => (
          <article
            key={id}
            className='flex gap-3 items-start p-3 sm:p-4 border border-border/60 bg-card'>
            <Skeleton className='w-20 h-20 rounded-none flex-shrink-0' />
            <div className='flex-1 min-w-0'>
              <div className='flex items-start justify-between gap-2'>
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-5 w-4/5' />
                  <Skeleton className='h-3 w-2/5' />
                </div>
                <Skeleton className='w-6 h-6 flex-shrink-0' />
              </div>
              <div className='mt-3'>
                <Skeleton className='h-3 w-full' />
                <Skeleton className='h-3 w-3/4 mt-1' />
              </div>
              <div className='flex items-center gap-2 mt-3'>
                <Skeleton className='h-3 w-24' />
                <Skeleton className='h-5 w-16' />
              </div>
            </div>
          </article>
        )
      )}
    </div>
  )
}

export function MixesSkeleton() {
  return (
    <div className='max-w-3xl mx-auto px-4 py-6'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6'>
        <div className='flex items-center gap-2'>
          <Skeleton className='w-2 h-2 rounded-sm' />
          <Skeleton className='h-6 w-16' />
        </div>
        <Skeleton className='h-8 w-full sm:w-40 rounded-sm' />
      </div>
      <MixesListSkeleton />
    </div>
  )
}
