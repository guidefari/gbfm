import type { SelectMdxCompiledRelease } from '@gbfm/vps/schemas'
import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { LongPost } from '@/components/Layout/LongPost'
import { RouteError } from '@/components/RouteError'
import { fetcher } from '@/lib/http'
import { generateReleaseSEO, generateSEOMeta } from '@/lib/seo'
import { useContentStore } from '@/store'

export const Route = createFileRoute('/releases/$slug')({
  component: ReleasePage,
  errorComponent: ({ error }) => <RouteError error={error} />,
  loader: async ({ params }) => {
    const release = await fetcher<SelectMdxCompiledRelease>(
      `${import.meta.env.VITE_VPS_BASE_URL}/content/releases/${params.slug}`
    )
    return { release }
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
  const { setCurrentContent } = useContentStore()

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
