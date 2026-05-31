import { createFileRoute, Link } from '@tanstack/react-router'
import { type DjListItem, useDjs } from '@/lib/http'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'

export const Route = createFileRoute('/djs/')({
  component: DjsListPage,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.djs)
  })
})

function DjsListPage() {
  const { data, isPending, error } = useDjs()

  if (isPending) {
    return <DjsSkeleton />
  }

  if (error) {
    return (
      <div className='p-4 text-center text-destructive'>Error loading DJs: {error.message}</div>
    )
  }

  if (!data || data.length === 0) {
    return <div className='p-4 text-center text-muted-foreground'>No DJs found yet.</div>
  }

  return (
    <div className='p-4 mx-auto max-w-7xl'>
      <h1 className='mb-2 text-3xl font-bold text-foreground'>DJs & Residents</h1>
      <p className='mb-6 text-muted-foreground'>Everyone who has a mix on goosebumps.fm.</p>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'>
        {data.map((dj) => (
          <DjCard key={dj.id} dj={dj} />
        ))}
      </div>
    </div>
  )
}

function DjCard({ dj }: { dj: DjListItem }) {
  const href = dj.username ?? dj.id
  return (
    <Link
      to='/$slug'
      params={{ slug: href }}
      className='group p-4 border rounded-none border-border/60 bg-muted/20 transition-colors hover:border-gb-highlight/50 hover:bg-gb-pastel-green-2/10'>
      <div className='flex items-center gap-3'>
        {dj.image ? (
          <img
            src={dj.image}
            alt={dj.name}
            className='object-cover w-14 h-14 rounded-sm'
            loading='lazy'
          />
        ) : (
          <div className='w-14 h-14 rounded-sm bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground'>
            {dj.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className='min-w-0 flex-1'>
          <h2 className='text-base font-bold truncate group-hover:text-gb-highlight'>{dj.name}</h2>
          {dj.username && <p className='text-xs text-muted-foreground truncate'>@{dj.username}</p>}
          <p className='mt-0.5 text-xs text-muted-foreground'>
            {dj.mixCount} {dj.mixCount === 1 ? 'mix' : 'mixes'}
          </p>
        </div>
      </div>
      {dj.bio && (
        <p className='mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-3'>{dj.bio}</p>
      )}
    </Link>
  )
}

function DjsSkeleton() {
  return (
    <div className='p-4 mx-auto max-w-7xl'>
      <div className='h-9 w-48 mb-6 bg-muted animate-pulse rounded-sm' />
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'>
        {Array.from({ length: 8 }, (_, i) => `dj-skel-${i}`).map((key) => (
          <div key={key} className='p-4 border rounded-none border-border/60 bg-muted/20'>
            <div className='flex items-center gap-3'>
              <div className='w-14 h-14 rounded-sm bg-muted animate-pulse' />
              <div className='flex-1 space-y-2'>
                <div className='h-4 w-24 bg-muted animate-pulse rounded-sm' />
                <div className='h-3 w-16 bg-muted animate-pulse rounded-sm' />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
