import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { ReleasesTable } from '@/components/ReleasesTable'
import { useLabelBySlug, useReleasesByLabel } from '@/lib/http'
import { useContentStore } from '@/store'

export const Route = createFileRoute('/labels/$labelSlug')({
  component: LabelPage
})

function LabelPage() {
  const { labelSlug } = Route.useParams()
  const { setCurrentContent } = useContentStore()

  const { data, error, isPending } = useLabelBySlug(labelSlug)
  const {
    data: releases,
    error: releasesError,
    isPending: releasesPending
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

  if (isPending) return <div className='p-4 text-center'>Loading...</div>
  if (error)
    return (
      <div className='p-4 text-center text-destructive'>
        Error: {error.message}
      </div>
    )
  if (!data) return <div className='p-4 text-center'>No data</div>

  return (
    <div className='mx-auto max-w-6xl'>
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        {/* Left sidebar with label metadata */}
        <div className='lg:col-span-1'>
          <div className='sticky top-6'>
            <div className='mb-6'>
              <img
                className='w-full rounded-lg'
                src={data.thumbnailUrl || '/fav.png'}
                alt={`Thumbnail for ${data.title}`}
                width={400}
                height={400}
                loading='lazy'
              />
            </div>

            <div className='space-y-4'>
              <h1 className='text-2xl font-bold'>{data.title}</h1>

              {data.description && (
                <p className='text-muted-foreground'>{data.description}</p>
              )}

              {(data.website || data.bandcamp || data.discogs) && (
                <div>
                  <h3 className='mb-3 text-lg font-semibold'>Links</h3>
                  <div className='flex flex-col gap-2'>
                    {data.website && (
                      <a
                        href={data.website}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-primary/10 hover:bg-primary/20'>
                        Website
                      </a>
                    )}
                    {data.bandcamp && (
                      <a
                        href={data.bandcamp}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-primary/10 hover:bg-primary/20'>
                        Bandcamp
                      </a>
                    )}
                    {data.discogs && (
                      <a
                        href={data.discogs}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-primary/10 hover:bg-primary/20'>
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
            <div className='text-center text-muted-foreground'>
              Loading releases...
            </div>
          ) : releasesError ? (
            <div className='text-center text-destructive'>
              Error loading releases: {releasesError.message}
            </div>
          ) : (
            <ReleasesTable releases={releases || []} />
          )}
        </div>
      </div>
    </div>
  )
}
