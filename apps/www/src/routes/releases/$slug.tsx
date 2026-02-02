import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { LongPost } from '@/components/Layout/LongPost'
import { useReleaseBySlug } from '@/lib/http'
import { generateReleaseSEO, generateSEOMeta } from '@/lib/seo'
import { useContentStore } from '@/store'

export const Route = createFileRoute('/releases/$slug')({
  component: ReleasePage,
  loader: async ({ params }) => {
    const response = await fetch(
      `${import.meta.env.VITE_VPS_BASE_URL}/content/releases/${params.slug}`,
      {
        credentials: 'include'
      }
    )
    if (!response.ok) {
      throw new Error('Release not found')
    }
    const release = await response.json()
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
  const { setCurrentContent } = useContentStore()

  const { data, error, isPending } = useReleaseBySlug(slug)

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

  if (isPending) return <div className='p-4 text-center'>Loading...</div>
  if (error)
    return (
      <div className='p-4 text-center text-destructive'>
        Error: {error.message}
      </div>
    )
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
