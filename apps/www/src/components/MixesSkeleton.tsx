import { Skeleton } from '@/components/ui/skeleton'

export function MixesSkeleton() {
  return (
    <div className='relative h-full font-jetbrains bg-background text-foreground'>
      <div className='grid h-full grid-cols-1 gap-4 p-4 md:grid-cols-2'>
        <div className='p-4 overflow-y-auto border-2 border-dashed rounded-sm border-muted-foreground/30 bg-card/10'>
          <div className='flex items-center justify-between gap-4 mb-4'>
            <div className='flex items-center gap-2'>
              <Skeleton className='w-2 h-2 rounded-sm' />
              <Skeleton className='h-6 w-16' />
            </div>
            <Skeleton className='h-8 w-40 rounded-sm' />
          </div>
          <div className='grid gap-2'>
            {Array.from({ length: 8 }, (_, index) => `skeleton-${index}`).map(
              (id) => (
                <article
                  key={id}
                  className='flex gap-3 items-start p-2 rounded-sm'>
                  <Skeleton className='w-14 h-14 rounded-sm flex-shrink-0' />
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between gap-2'>
                      <Skeleton className='flex-1 h-4' />
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
        </div>

        <div className='p-4 overflow-y-auto border-2 border-dashed rounded-sm border-muted-foreground/30 bg-card/10 flex flex-col items-center justify-center text-center'>
          <Skeleton className='h-6 w-48 mb-2' />
          <Skeleton className='h-4 w-64' />
        </div>
      </div>
    </div>
  )
}
