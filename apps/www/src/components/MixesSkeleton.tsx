import { Skeleton } from '@/components/ui/skeleton'

export function MixesListSkeleton() {
  return (
    <div className='grid gap-2'>
      {Array.from({ length: 8 }, (_, index) => `skeleton-${index}`).map(
        (id) => (
          <article key={id} className='flex gap-3 items-start p-2 rounded-sm'>
            <Skeleton className='w-16 h-16 sm:w-20 sm:h-20 rounded-sm flex-shrink-0' />
            <div className='flex-1 min-w-0'>
              <div className='flex items-start justify-between gap-2'>
                <Skeleton className='flex-1 h-5' />
                <Skeleton className='w-4 h-4 flex-shrink-0' />
              </div>
              <div className='mt-1'>
                <Skeleton className='h-3 w-full' />
                <Skeleton className='h-3 w-3/4 mt-1' />
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
