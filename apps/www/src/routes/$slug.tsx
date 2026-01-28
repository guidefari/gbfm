import { createFileRoute, Link } from '@tanstack/react-router'
import { MDXRendrr } from '@/components/MDXRendrr'
import { ProfileContentGrid } from '@/components/profile/ProfileContentGrid'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { EpisodeGrid } from '@/components/shows/EpisodeGrid'
import { SubscribeButton } from '@/components/shows/SubscribeButton'
import { type ResolveResult, useResolveSlug, VPS_BASE_URL } from '@/lib/http'
import {
  generateProfileSEO,
  generateResolvedShowSEO,
  generateSEOMeta
} from '@/lib/seo'

export const Route = createFileRoute('/$slug')({
  component: SlugPage,
  loader: async ({ params }) => {
    try {
      const response = await fetch(`${VPS_BASE_URL}/resolve/${params.slug}`, {
        credentials: 'include'
      })
      if (!response.ok) return { resolved: null }
      const resolved: ResolveResult = await response.json()
      return { resolved }
    } catch {
      return { resolved: null }
    }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.resolved) {
      return {
        meta: [
          { title: 'Not found | goosebumps.fm' },
          {
            name: 'description',
            content: 'This page does not exist on goosebumps.fm'
          }
        ]
      }
    }

    if (loaderData.resolved.type === 'profile') {
      const seoData = generateProfileSEO(loaderData.resolved.data, params.slug)
      return { meta: generateSEOMeta(seoData) }
    }

    const seoData = generateResolvedShowSEO(
      loaderData.resolved.data,
      params.slug
    )
    return { meta: generateSEOMeta(seoData) }
  }
})

function NotFound({ slug }: { slug: string }) {
  return (
    <div className='mx-auto max-w-md px-4 py-16 text-center'>
      <h1 className='text-3xl font-bold text-foreground'>Not found</h1>
      <p className='mt-3 text-muted-foreground'>
        <span className='font-medium text-foreground'>@{slug}</span> doesn't
        exist.
      </p>
      <div className='mt-6 flex justify-center gap-3'>
        <Link
          to='/'
          className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90'>
          Go home
        </Link>
        <Link
          to='/mixes'
          className='rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted'>
          Browse mixes
        </Link>
      </div>
    </div>
  )
}

function ProfileView({
  profile
}: {
  profile: NonNullable<Extract<ResolveResult, { type: 'profile' }>>['data']
}) {
  return (
    <div className='mx-auto max-w-6xl px-4 py-6'>
      <ProfileHeader profile={profile} />
      <div className='mt-8'>
        <ProfileContentGrid content={profile.content} />
      </div>
    </div>
  )
}

function ShowView({
  show
}: {
  show: NonNullable<Extract<ResolveResult, { type: 'show' }>>['data']
}) {
  return (
    <div className='mx-auto max-w-6xl px-4 py-6'>
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        <div className='lg:col-span-1'>
          <div className='sticky top-6'>
            <div className='mb-6'>
              <img
                className='w-full rounded-sm'
                src={show.thumbnailUrl || '/fav.png'}
                alt={`Thumbnail for ${show.title}`}
                width={400}
                height={400}
                loading='lazy'
              />
            </div>

            <div className='space-y-4'>
              <h1 className='text-2xl font-bold'>{show.title}</h1>

              {show.hosts && show.hosts.length > 0 && (
                <p className='text-muted-foreground'>
                  Hosted by{' '}
                  {show.hosts.map((host, index) => (
                    <span key={host.id}>
                      {host.username ? (
                        <Link
                          to='/$slug'
                          params={{ slug: host.username }}
                          className='text-foreground hover:underline'>
                          {host.name}
                        </Link>
                      ) : (
                        host.name
                      )}
                      {index < show.hosts.length - 1 && ', '}
                    </span>
                  ))}
                </p>
              )}

              {show.description && (
                <p className='text-muted-foreground'>{show.description}</p>
              )}

              <SubscribeButton showId={show.id} showTitle={show.title} />
            </div>
          </div>
        </div>

        <div className='lg:col-span-2 space-y-8'>
          {show.compiledContent && (
            <div className='prose prose-neutral dark:prose-invert max-w-none'>
              <MDXRendrr mdxString={show.compiledContent} />
            </div>
          )}

          <EpisodeGrid showSlug={show.slug} />
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className='mx-auto max-w-6xl px-4 py-6'>
      <div className='flex flex-col items-center gap-4 sm:flex-row sm:items-start'>
        <div className='h-24 w-24 animate-pulse rounded-full bg-muted' />
        <div className='space-y-2'>
          <div className='h-6 w-32 animate-pulse rounded bg-muted' />
          <div className='h-4 w-24 animate-pulse rounded bg-muted' />
        </div>
      </div>
    </div>
  )
}

function SlugPage() {
  const { slug } = Route.useParams()
  const { resolved: loaderResolved } = Route.useLoaderData()
  const { data, error, isPending } = useResolveSlug(slug)

  const resolved = data ?? loaderResolved

  if (isPending && !resolved) {
    return <LoadingSkeleton />
  }

  if (!resolved || error) {
    return <NotFound slug={slug} />
  }

  if (resolved.type === 'profile') {
    return <ProfileView profile={resolved.data} />
  }

  return <ShowView show={resolved.data} />
}
