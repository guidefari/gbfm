import { Skeleton } from '@/components/ui/skeleton'

export function MixesSkeleton() {
  return (
    <div className='grid gap-2 p-2 max-w-lg min-h-screen font-jetbrains bg-background text-foreground'>
      {Array.from({ length: 6 }).map((_, index) => (
        <article key={index} className='flex gap-3 items-start p-2'>
          <Skeleton className='w-14 h-14 border border-border' />
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
          </div>
        </article>
      ))}
    </div>
  )
}
