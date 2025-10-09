import { createFileRoute, Link } from '@tanstack/react-router'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAllLabels } from '@/lib/http'

export const Route = createFileRoute('/labels/')({
  component: Component
})

function Component() {
  const { data, isPending, error } = useAllLabels()

  if (isPending) {
    return (
      <div className='p-4'>
        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className='flex flex-col gap-2'>
              <div className='aspect-square w-full bg-muted/50 rounded-lg animate-pulse' />
              <div className='h-4 bg-muted/50 rounded animate-pulse' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='p-4 text-center text-destructive'>
        Error loading labels: {error.message}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className='p-4 text-center text-muted-foreground'>
        No labels found
      </div>
    )
  }

  return (
    <div className='p-4 max-w-7xl mx-auto'>
      <h1 className='text-3xl font-bold mb-6 text-foreground'>Record Labels</h1>
      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'>
        {data.map((label) => (
          <Link
            key={label.id}
            to='/labels/$labelSlug'
            params={{ labelSlug: label.slug }}
            className='group flex flex-col gap-2 transition-transform hover:scale-105'>
            <div className='aspect-square w-full overflow-hidden rounded-lg border border-border bg-background shadow-sm'>
              <img
                src={label.thumbnailUrl || DEFAULT_IMAGE_URL}
                alt={label.title}
                className='object-cover w-full h-full group-hover:opacity-80 transition-opacity'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <h2 className='font-semibold text-sm leading-tight text-foreground group-hover:text-highlight transition-colors line-clamp-2'>
                {label.title}
              </h2>
              {label.genres && label.genres.length > 0 && (
                <p className='text-xs text-muted-foreground line-clamp-1'>
                  {label.genres.join(', ')}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
