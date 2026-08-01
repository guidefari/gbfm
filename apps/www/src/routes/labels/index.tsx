import { createFileRoute, Link } from '@tanstack/react-router'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useLabels } from '@/lib/http'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'

export const Route = createFileRoute('/labels/')({
  component: Component,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.labels)
  })
})

function Component() {
  const { data, isPending, error } = useLabels()

  if (isPending) {
    return (
      <div className='p-4'>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
          {Array.from({ length: 12 }).map((_, i) => (
            // oxlint-disable-next-line react/no-array-index-key
            <div key={i} className='flex flex-col gap-2'>
              <div className='w-full rounded-sm aspect-square bg-muted/50 animate-pulse' />
              <div className='h-4 rounded bg-muted/50 animate-pulse' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='p-4 text-center text-destructive'>Error loading labels: {error.message}</div>
    )
  }

  if (!data || data.length === 0) {
    return <div className='p-4 text-center text-muted-foreground'>No labels found</div>
  }

  return (
    <div className='p-4 mx-auto max-w-7xl'>
      <h1 className='mb-6 text-3xl font-bold text-foreground'>Record Labels</h1>
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
        {data.map((label) => (
          <Link
            key={label.id}
            to='/labels/$labelSlug'
            params={{ labelSlug: label.slug }}
            className='flex flex-col gap-2 transition-transform group hover:scale-105'>
            <div className='w-full overflow-hidden border rounded-sm shadow-sm aspect-square border-border bg-background'>
              <img
                src={label.imageUrl || DEFAULT_IMAGE_URL}
                alt={label.name}
                className='object-cover w-full h-full transition-opacity group-hover:opacity-80'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <h2 className='text-base font-semibold leading-tight transition-colors text-foreground group-hover:text-highlight line-clamp-2'>
                {label.name}
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
