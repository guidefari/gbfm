import { Skeleton } from '@/components/ui/skeleton'

export function MixesSkeleton() {
  return (
    <div className='grid h-full grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3 font-jetbrains bg-background text-foreground'>
      {/* Left Column - Audio Player at bottom only */}
      <div className='p-4 border-2 border-dashed rounded-lg border-muted-foreground/30 flex flex-col'>
        <div className='flex-1' />
        {/* Audio Player Skeleton at bottom */}
        <div className='space-y-4'>
          <Skeleton className='h-8 w-32' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-3/4' />
          <div className='flex items-center gap-2 mt-6'>
            <Skeleton className='w-8 h-8 rounded-full' />
            <Skeleton className='h-6 w-16' />
          </div>
          <Skeleton className='h-2 w-full mt-4' />
          <div className='flex items-center justify-between mt-2'>
            <Skeleton className='h-4 w-12' />
            <Skeleton className='h-4 w-12' />
          </div>
        </div>
      </div>

      {/* Middle Column - Center aligned text when no mix selected */}
      <div className='p-4 border-2 border-dashed rounded-lg border-muted-foreground/30 flex flex-col items-center justify-center text-center'>
        <Skeleton className='h-6 w-32 mb-2' />
        <Skeleton className='h-4 w-48' />
      </div>

      {/* Right Column - Mixes List Skeleton */}
      <div className='p-4 border-2 border-dashed rounded-lg border-muted-foreground/30'>
        <Skeleton className='h-6 w-16 mb-4' />
        <div className='space-y-2'>
          {Array.from({ length: 8 }, (_, index) => `skeleton-${index}`).map(
            (id) => (
              <article
                key={id}
                className='flex gap-3 items-start p-2 transition-colors cursor-pointer hover:bg-muted/50 rounded-lg'>
                <button
                  type='button'
                  className='relative group focus:outline-none'
                  disabled>
                  <Skeleton className='object-cover border rounded-lg w-14 h-14 border-border bg-background' />
                  <span className='absolute inset-0 flex items-center justify-center transition-opacity rounded-lg opacity-0 bg-black/50'>
                    <Skeleton className='w-6 h-6' />
                  </span>
                </button>
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
    </div>
  )
}
