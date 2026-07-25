import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import * as React from 'react'
import { LongPost } from '@/components/Layout/LongPost'
import { RouteError } from '@/components/RouteError'
import { getApiClient } from '@/lib/api-client'
import { generateReleaseSEO, generateSEOMeta } from '@/lib/seo'
import { captureException } from '@/services/analytics'
import { useSetCurrentContent } from '@/store'

export const Route = createFileRoute('/releases/$slug')({
  component: ReleasePage,
  errorComponent: ({ error }) => <RouteError error={error} />,
  loader: async ({ params }) => {
    const client = await getApiClient()
    const release = await Effect.runPromise(
      client.release
        .getReleaseBySlug({ params: { slug: params.slug } })
        .pipe(
          Effect.tapError((error) =>
            captureException(error, { endpoint: 'release.getReleaseBySlug' })
          )
        )
    )
    return {
      release: {
        ...release,
        bannerImageUrl: null,
        createdAt: new Date(release.createdAt),
        updatedAt: new Date(release.updatedAt),
        releaseDate: release.releaseDate ? new Date(release.releaseDate) : null,
        tags: release.tags ? [...release.tags] : null,
        streamingLinks: release.streamingLinks ? [...release.streamingLinks] : null
      }
    }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.release) {
      return {
        meta: [
          {
            title: 'Release | goosebumps.fm'
          },
          {
            name: 'description',
            content: 'Discover music releases on goosebumps.fm'
          }
        ]
      }
    }

    const seoData = generateReleaseSEO(loaderData.release, params.slug)
    return {
      meta: generateSEOMeta(seoData)
    }
  }
})

function ReleasePage() {
  const { slug } = Route.useParams()
  const { release: data } = Route.useLoaderData()
  const setCurrentContent = useSetCurrentContent()

  React.useEffect(() => {
    if (data) {
      const contentInfo = {
        id: slug,
        archetype: 'release',
        creatorIds: [] // Releases don't have creators directly
      }
      setCurrentContent(contentInfo)
    }

    return () => setCurrentContent(null)
  }, [data, slug, setCurrentContent])

  if (!data) return <div className='p-4 text-center'>No data</div>

  return (
    <div className='max-w-4xl mx-auto'>
      <LongPost
        title={data.title}
        description={data.description ?? ''}
        content={data.compiledContent ?? data.content}
        thumbnailUrl={data.thumbnailUrl ?? ''}
        date={data.releaseDate ?? data.createdAt}
        slug={slug}
        shareType='release'
      />
    </div>
  )
}
