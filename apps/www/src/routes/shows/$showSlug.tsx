import { ReadMoreModal } from '@gbfm/ui'
import type { SelectMdxCompiledShow } from '@gbfm/vps/schemas'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { FavoriteButton } from '@/components/FavoriteButton'
import { MDXRendrr } from '@/components/MDXRendrr'
import { ShareButton } from '@/components/ShareButton'
import { EpisodeGrid } from '@/components/shows/EpisodeGrid'
import { ShowQRButton } from '@/components/shows/ShowQRButton'
import { fetcher, useShowBySlug } from '@/lib/http'
import { generateSEOMeta, generateShowSEO } from '@/lib/seo'
import { useContentStore } from '@/store'

export const Route = createFileRoute('/shows/$showSlug')({
  component: ShowPage,
  loader: async ({ params }) => {
    const show = await fetcher<SelectMdxCompiledShow>(
      `${import.meta.env.VITE_VPS_BASE_URL}/shows/${params.showSlug}`
    )
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
              <h1 className='text-2xl font-bold wrap-break-word'>
                {data.title}
              </h1>

              {hostNames && (
                <p className='text-sm text-muted-foreground'>
                  Hosted by {hostNames}
                </p>
              )}

              {(data.description || data.compiledContent) && (
                <ShowDescription
                  title={data.title}
                  description={data.description || ''}
                  compiledContent={data.compiledContent}
                />
              )}

              <div className='flex gap-2'>
                <FavoriteButton
                  contentType='show'
                  contentId={data.id}
                  contentTitle={data.title}
                />
                <ShareButton type='show' slug={showSlug} />
                <ShowQRButton slug={showSlug} />
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
        {compiledContent ? (
          <MDXRendrr mdxString={compiledContent} />
        ) : (
          <p>{description}</p>
        )}
      </div>
      {hasExpandableContent && (
        <ReadMoreModal
          title={title}
          trigger={
            <span className='text-sm font-medium text-primary underline underline-offset-4 cursor-pointer hover:opacity-80'>
              read more
            </span>
          }>
          {compiledContent ? (
            <MDXRendrr mdxString={compiledContent} />
          ) : (
            <p>{description}</p>
          )}
        </ReadMoreModal>
      )}
    </div>
  )
}
