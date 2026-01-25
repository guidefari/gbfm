import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { EpisodeGrid } from '@/components/shows/EpisodeGrid'
import { SubscribeButton } from '@/components/shows/SubscribeButton'
import { useShowBySlug } from '@/lib/http'
import { generateSEOMeta, generateShowSEO } from '@/lib/seo'
import { useContentStore } from '@/store'

export const Route = createFileRoute('/shows/$showSlug')({
  component: ShowPage,
  loader: async ({ params }) => {
    const response = await fetch(
      `${import.meta.env.VITE_VPS_BASE_URL}/shows/${params.showSlug}`,
      {
        credentials: 'include'
      }
    )
    if (!response.ok) {
      throw new Error('Show not found')
    }
    const show = await response.json()
    return { show }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.show) {
      return {
        meta: [
          {
            title: 'Show | goosebumps.fm'
          },
          {
            name: 'description',
            content: 'Explore radio shows on goosebumps.fm'
          }
        ]
      }
    }

    const seoData = generateShowSEO(loaderData.show, params.showSlug)
    return {
      meta: generateSEOMeta(seoData)
    }
  }
})

function ShowPage() {
  const { showSlug } = Route.useParams()
  const { setCurrentContent } = useContentStore()

  const { data, error, isPending } = useShowBySlug(showSlug)

  useEffect(() => {
    if (data?.hosts) {
      const contentInfo = {
        id: showSlug,
        archetype: 'show',
        creatorIds: data.hosts.map((host) => host.id)
      }
      setCurrentContent(contentInfo)
    }

    return () => setCurrentContent(null)
  }, [data, showSlug, setCurrentContent])

  if (isPending) return <div className='p-4 text-center'>Loading...</div>
  if (error)
    return (
      <div className='p-4 text-center text-destructive'>
        Error: {error.message}
      </div>
    )
  if (!data) return <div className='p-4 text-center'>No data</div>

  const hostNames = data.hosts?.map((h) => h.name).join(', ')

  return (
    <div className='mx-auto max-w-6xl px-4 py-6'>
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        <div className='lg:col-span-1'>
          <div className='sticky top-6'>
            <div className='mb-6'>
              <img
                className='w-full rounded-sm'
                src={data.thumbnailUrl || '/fav.png'}
                alt={`Thumbnail for ${data.title}`}
                width={400}
                height={400}
                loading='lazy'
              />
            </div>

            <div className='space-y-4'>
              <h1 className='text-2xl font-bold'>{data.title}</h1>

              {hostNames && (
                <p className='text-muted-foreground'>Hosted by {hostNames}</p>
              )}

              {data.description && (
                <p className='text-muted-foreground'>{data.description}</p>
              )}

              <SubscribeButton showId={data.id} showTitle={data.title} />
            </div>
          </div>
        </div>

        <div className='lg:col-span-2 space-y-8'>
          {data.compiledContent && (
            <div className='prose prose-neutral dark:prose-invert max-w-none'>
              <MDXRendrr mdxString={data.compiledContent} />
            </div>
          )}

          <EpisodeGrid showSlug={showSlug} />
        </div>
      </div>
    </div>
  )
}
