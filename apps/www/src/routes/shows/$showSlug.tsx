import { ReadMoreModal } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { useEffect } from 'react'
import { FavoriteButton } from '@/components/FavoriteButton'
import { MDXRendrr } from '@/components/MDXRendrr'
import { RouteError } from '@/components/RouteError'
import { ShareButton } from '@/components/ShareButton'
import { EpisodeGrid } from '@/components/shows/EpisodeGrid'
import { ShowQRButton } from '@/components/shows/ShowQRButton'
import { getApiClient } from '@/lib/api-client'
import { generateSEOMeta, generateShowSEO } from '@/lib/seo'
import { captureException } from '@/services/analytics'
import { useContentStore } from '@/store'
import { ShowMetadataManager } from './_components/-ShowMetadataManager'

export const Route = createFileRoute('/shows/$showSlug')({
  component: ShowPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
  loader: async ({ params }) => {
    const client = await getApiClient()
    const show = await Effect.runPromise(
      client.shows
        .getShowBySlug({ params: { slug: params.showSlug } })
        .pipe(
          Effect.tapError((error) => captureException(error, { endpoint: 'shows.getShowBySlug' }))
        )
    )
    return {
      show: {
        ...show,
        createdAt: new Date(show.createdAt),
        updatedAt: new Date(show.updatedAt),
        tags: show.tags ? [...show.tags] : null,
        hosts: show.hosts ? [...show.hosts] : undefined
      }
    }
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
  const { show: data } = Route.useLoaderData()
  const { setCurrentContent } = useContentStore()

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

  if (!data) return <div className='p-4 text-center'>No data</div>

  const hostNames = data.hosts?.map((h) => h.name).join(', ')

  return (
    <div className='max-w-7xl px-4 py-6 mx-auto overflow-hidden'>
      <div className='grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)]'>
        <div className='lg:col-span-1'>
          <div className='sticky top-6'>
            <div className='mb-4'>
              <img
                className='w-full rounded-sm'
                src={data.thumbnailUrl || '/fav.png'}
                alt={`Thumbnail for ${data.title}`}
                width={400}
                height={400}
                loading='lazy'
              />
            </div>

            <div className='space-y-3 min-w-0'>
              <h1 className='text-2xl font-bold wrap-break-word'>{data.title}</h1>

              {hostNames && <p className='text-sm text-muted-foreground'>Hosted by {hostNames}</p>}

              {(data.description || data.compiledContent) && (
                <ShowDescription
                  title={data.title}
                  description={data.description || ''}
                  compiledContent={data.compiledContent}
                />
              )}

              <div className='flex gap-2 flex-wrap'>
                <FavoriteButton contentType='show' contentId={data.id} contentTitle={data.title} />
                <ShareButton type='show' slug={showSlug} />
                <ShowQRButton slug={showSlug} />
                <ShowMetadataManager show={data} />
              </div>
            </div>
          </div>
        </div>

        <div className='lg:col-span-1 min-w-0'>
          <EpisodeGrid showSlug={showSlug} />
        </div>
      </div>
    </div>
  )
}

function ShowDescription({
  title,
  description,
  compiledContent
}: {
  title: string
  description: string
  compiledContent?: string
}) {
  const hasExpandableContent = description.length > 120 || compiledContent

  return (
    <div>
      <div className='text-sm text-muted-foreground line-clamp-4 prose prose-sm prose-neutral dark:prose-invert max-w-none wrap-break-word overflow-hidden [&_p]:text-muted-foreground [&_p]:text-sm'>
        {compiledContent ? <MDXRendrr mdxString={compiledContent} /> : <p>{description}</p>}
      </div>
      {hasExpandableContent && (
        <ReadMoreModal
          title={title}
          trigger={
            <span className='text-sm font-medium text-primary underline underline-offset-4 cursor-pointer hover:opacity-80'>
              read more
            </span>
          }>
          {compiledContent ? <MDXRendrr mdxString={compiledContent} /> : <p>{description}</p>}
        </ReadMoreModal>
      )}
    </div>
  )
}
