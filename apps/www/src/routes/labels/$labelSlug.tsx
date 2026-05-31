import { Button } from '@gbfm/ui'
import type { SelectMdxCompiledLabel } from '@gbfm/vps/schemas'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Edit } from 'lucide-react'
import * as React from 'react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { ReleasesTable } from '@/components/ReleasesTable'
import { RouteError } from '@/components/RouteError'
import { ShareButton } from '@/components/ShareButton'
import { useSession } from '@/lib/auth-client'
import { fetcher, useReleasesByLabel } from '@/lib/http'
import { generateLabelSEO, generateSEOMeta } from '@/lib/seo'
import { useContentStore } from '@/store'

export const Route = createFileRoute('/labels/$labelSlug')({
  component: LabelPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
  loader: async ({ params }) => {
    const label = await fetcher<SelectMdxCompiledLabel>(
      `${import.meta.env.VITE_VPS_BASE_URL}/content/labels/${params.labelSlug}`
    )
    return { label }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.label) {
      return {
        meta: [
          {
            title: 'Label | goosebumps.fm'
          },
          {
            name: 'description',
            content: 'Explore music labels on goosebumps.fm'
          }
        ]
      }
    }

    const seoData = generateLabelSEO(loaderData.label, params.labelSlug)
    return {
      meta: generateSEOMeta(seoData)
    }
  }
})

function LabelPage() {
  const { labelSlug } = Route.useParams()
  const { label: data } = Route.useLoaderData()
  const { setCurrentContent } = useContentStore()
  const { data: session } = useSession()
  const navigate = useNavigate()
  const isAdmin = session?.user?.role === 'admin'

  const handleEdit = () => {
    navigate({
      to: '/label-upload',
      search: {
        edit: labelSlug,
        title: data?.title || '',
        description: data?.description || '',
        content: data?.content || '',
        thumbnailUrl: data?.thumbnailUrl || '',
        website: data?.website || '',
        bandcamp: data?.bandcamp || '',
        discogs: data?.discogs || ''
      }
    })
  }
  const {
    data: releases,
    error: releasesError,
    isPending: releasesPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useReleasesByLabel(labelSlug)

  React.useEffect(() => {
    if (data?.creators) {
      const contentInfo = {
        id: labelSlug,
        archetype: 'label',
        creatorIds: data.creators.map((creator) => creator.id)
      }
      setCurrentContent(contentInfo)
    }

    return () => setCurrentContent(null)
  }, [data, labelSlug, setCurrentContent])

  if (!data) return <div className='p-4 text-center'>No data</div>

  return (
    <div className='mx-auto max-w-6xl'>
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        {/* Left sidebar with label metadata */}
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
              <div className='flex items-start justify-between'>
                <h1 className='text-2xl font-bold'>{data.title}</h1>
                <div className='flex gap-2'>
                  <ShareButton type='label' slug={labelSlug} />
                  {isAdmin && (
                    <Button
                      onClick={handleEdit}
                      variant='outline'
                      size='sm'
                      className='flex items-center gap-2'>
                      <Edit className='w-4 h-4' />
                      Edit Label
                    </Button>
                  )}
                </div>
              </div>

              {data.description && <p className='text-muted-foreground'>{data.description}</p>}

              {(data.website || data.bandcamp || data.discogs) && (
                <div>
                  <h3 className='mb-3 text-lg font-semibold'>Links</h3>
                  <div className='flex flex-col gap-2'>
                    {data.website && (
                      <a
                        href={data.website}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='px-4 py-2 text-sm font-medium rounded-sm transition-colors bg-primary/10 hover:bg-primary/20'>
                        Website
                      </a>
                    )}
                    {data.bandcamp && (
                      <a
                        href={data.bandcamp}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='px-4 py-2 text-sm font-medium rounded-sm transition-colors bg-primary/10 hover:bg-primary/20'>
                        Bandcamp
                      </a>
                    )}
                    {data.discogs && (
                      <a
                        href={data.discogs}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='px-4 py-2 text-sm font-medium rounded-sm transition-colors bg-primary/10 hover:bg-primary/20'>
                        Discogs
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className='lg:col-span-2 space-y-8'>
          {/* Label content */}
          <div className='prose prose-neutral dark:prose-invert max-w-none'>
            <MDXRendrr mdxString={data.compiledContent ?? data.content} />
          </div>

          {/* Releases section */}
          {releasesPending ? (
            <div className='text-center text-muted-foreground'>Loading releases...</div>
          ) : releasesError ? (
            <div className='text-center text-destructive'>
              Error loading releases: {releasesError.message}
            </div>
          ) : (
            <>
              <ReleasesTable releases={releases || []} />
              {hasNextPage && (
                <div className='flex justify-center mt-6'>
                  <Button
                    variant='outline'
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className='px-6 py-3 text-sm font-medium transition-colors'>
                    {isFetchingNextPage ? 'Loading...' : 'Load More Releases'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
