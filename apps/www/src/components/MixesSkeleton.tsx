import { Skeleton } from '@/components/ui/skeleton'

export function MixesListSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }, (_, index) => `skeleton-${index}`).map(
        (id, index) => (
          <div
            key={id}
            className='relative grid grid-cols-[1rem_1fr] gap-x-4 pb-6 last:pb-0'>
            {index < 7 && (
              <div className='absolute left-2 top-0 bottom-0 w-px -translate-x-1/2 bg-border' />
            )}

            <div className='flex items-center justify-center'>
              <Skeleton className='h-2.5 w-2.5 rounded-full' />
            </div>

            <Skeleton className='h-4 w-28 mt-0.5' />

            <div />

            <article className='pt-2 pb-1'>
              <div className='border border-border/60 bg-card p-5 sm:p-6'>
                <div className='flex flex-col gap-6 lg:flex-row'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='flex-1 space-y-3'>
                        <Skeleton className='h-8 w-4/5 max-w-md' />
                        <Skeleton className='h-3 w-40' />
                      </div>
                      <Skeleton className='h-8 w-8 rounded-sm' />
                    </div>

                    <div className='mt-4 flex flex-wrap gap-2'>
                      <Skeleton className='h-8 w-24' />
                      {index % 3 === 0 && <Skeleton className='h-8 w-20' />}
                    </div>

                    {index % 2 === 1 && (
                      <div className='mt-4 space-y-2 border-l-2 border-highlight/20 pl-4 py-1'>
                        <Skeleton className='h-4 w-full max-w-lg' />
                        <Skeleton className='h-4 w-3/4 max-w-md' />
                      </div>
                    )}

                    <div className='mt-5 flex items-center gap-5 border-t border-border/50 pt-4'>
                      <Skeleton className='h-11 w-44' />
                      <Skeleton className='h-4 w-32' />
                    </div>
                  </div>

                  <Skeleton className='order-first h-48 w-full border border-border lg:order-last lg:w-48 rounded-none' />
                </div>
              </div>
            </article>
          </div>
        )
      )}
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
