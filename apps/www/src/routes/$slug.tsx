import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import {
  PublicProfilePage,
  PublicProfilePageSkeleton
} from '@/components/profile/PublicProfilePage'
import {
  fetcher,
  type ResolveResult,
  useResolveSlug,
  VPS_BASE_URL
} from '@/lib/http'
import {
  generateProfileSEO,
  generateResolvedShowSEO,
  generateSEOMeta
} from '@/lib/seo'

export const Route = createFileRoute('/$slug')({
  component: SlugPage,
  loader: async ({ params }) => {
    try {
      const resolved = await fetcher<ResolveResult>(
        `${VPS_BASE_URL}/resolve/${params.slug}`
      )
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
    <div className='max-w-md px-4 py-16 mx-auto text-center'>
      <h1 className='text-3xl font-bold text-foreground'>Not found</h1>
      <p className='mt-3 text-muted-foreground'>
        <span className='font-medium text-foreground'>@{slug}</span> doesn't
        exist.
      </p>
      <div className='flex justify-center gap-3 mt-6'>
        <Link
          to='/'
          className='px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90'>
          Go home
        </Link>
        <Link
          to='/mixes'
          className='px-4 py-2 text-sm font-medium border rounded-md border-border text-foreground hover:bg-muted'>
          Browse mixes
        </Link>
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
    return <PublicProfilePageSkeleton />
  }

  if (!resolved || error) {
    return <NotFound slug={slug} />
  }

  if (resolved.type === 'profile') {
    return <PublicProfilePage profile={resolved.data} />
  }

  return (
    <Navigate to='/shows/$showSlug' params={{ showSlug: resolved.data.slug }} />
  )
}
