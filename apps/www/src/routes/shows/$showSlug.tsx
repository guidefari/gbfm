import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { useEffect } from 'react'
import { FavoriteButton } from '@/components/FavoriteButton'
import { RouteError } from '@/components/RouteError'
import { ShareButton } from '@/components/ShareButton'
import { EpisodeGrid } from '@/components/shows/EpisodeGrid'
import { ShowDescription } from '@/components/shows/ShowDescription'
import { ShowDetailHeroImage } from '@/components/shows/ShowDetailHeroImage'
import { ShowQRButton } from '@/components/shows/ShowQRButton'
import { getApiClient } from '@/lib/api-client'
import { generateSEOMeta, generateShowSEO } from '@/lib/seo'
import { captureException } from '@/services/analytics'
import { useSetCurrentContent } from '@/store'
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
  const setCurrentContent = useSetCurrentContent()

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
      <div className='grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)]'>
        <div className='lg:col-span-1'>
          <div className='sticky top-6'>
            <div className='flex gap-4 sm:flex-col'>
              <div className='w-24 sm:w-full shrink-0'>
                <ShowDetailHeroImage thumbnailUrl={data.thumbnailUrl} title={data.title} />
              </div>
              <div className='min-w-0 sm:mt-4'>
                <h1 className='text-xl sm:text-2xl font-bold wrap-break-word'>{data.title}</h1>
                {hostNames && (
                  <p className='mt-1 text-sm text-muted-foreground'>Hosted by {hostNames}</p>
                )}
              </div>
            </div>

            <div className='mt-4 space-y-3 min-w-0'>
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
