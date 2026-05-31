import { Skeleton } from './skeleton'

export function ShowsSkeleton() {
  return (
    <div className='p-4 mx-auto max-w-7xl'>
      <Skeleton className='h-9 w-48 mb-6' />
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
        {Array.from({ length: 12 }, (_, index) => `show-skeleton-${index}`).map((id) => (
          <div key={id} className='flex flex-col gap-2'>
            <Skeleton className='w-full rounded-sm aspect-square' />
            <Skeleton className='h-4 w-3/4' />
          </div>
        ))}
      </div>
    </div>
  )
}
