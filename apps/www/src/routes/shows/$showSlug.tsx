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
    <div className='max-w-7xl min-w-0 px-4 py-4 mx-auto sm:py-6'>
      <div className='grid min-w-0 grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)]'>
        <div className='min-w-0 lg:col-span-1'>
          <div className='grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-border/40 pb-5 lg:sticky lg:top-6 lg:block lg:border-0 lg:pb-0'>
            <div className='lg:mb-4'>
              <img
                className='w-28 aspect-square object-cover border border-border rounded-sm lg:w-full'
                src={data.thumbnailUrl || '/fav.png'}
                alt={`Artwork for ${data.title}`}
                width={400}
                height={400}
                fetchPriority='high'
                sizes='(max-width: 1023px) 112px, 30vw'
              />
            </div>

            <div className='min-w-0 space-y-2 lg:space-y-3'>
              <h1 className='text-xl font-black leading-tight tracking-tight wrap-break-word sm:text-2xl'>
                {data.title}
              </h1>

              {hostNames && <p className='text-sm text-muted-foreground'>Hosted by {hostNames}</p>}

              <div className='flex gap-2 flex-wrap lg:hidden'>
                <FavoriteButton
                  contentType='show'
                  contentId={data.id}
                  contentTitle={data.title}
                  className='min-h-11 min-w-11'
                />
                <ShareButton type='show' slug={showSlug} className='min-h-11 min-w-11' />
                <ShowQRButton slug={showSlug} className='min-h-11 min-w-11' />
                <ShowMetadataManager show={data} />
              </div>
            </div>

            <div className='col-span-2 min-w-0 lg:mt-3'>
              {(data.description || data.compiledContent) && (
                <ShowDescription
                  title={data.title}
                  description={data.description || ''}
                  compiledContent={data.compiledContent}
                />
              )}

              <div className='hidden gap-2 flex-wrap lg:flex'>
                <FavoriteButton
                  contentType='show'
                  contentId={data.id}
                  contentTitle={data.title}
                  className='min-h-11 min-w-11'
                />
                <ShareButton type='show' slug={showSlug} className='min-h-11 min-w-11' />
                <ShowQRButton slug={showSlug} className='min-h-11 min-w-11' />
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
