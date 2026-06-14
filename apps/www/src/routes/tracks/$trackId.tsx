import type { SelectMdxCompiledAudio } from '@gbfm/vps/schemas'
import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { LongPost } from '@/components/Layout/LongPost'
import { RouteError } from '@/components/RouteError'
import { apiUrl, fetcher } from '@/lib/http'
import { generateSEOMeta, generateTrackSEO } from '@/lib/seo'
import { useContentStore } from '@/store'

export const Route = createFileRoute('/tracks/$trackId')({
  component: TrackPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
  loader: async ({ params }) => {
    const track = await fetcher<SelectMdxCompiledAudio>(
      apiUrl(`/content/audio/track/${params.trackId}`)
    )
    return { track }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.track) {
      return {
        meta: [
          {
            title: 'Track | goosebumps.fm'
          },
          {
            name: 'description',
            content: 'Listen to individual tracks on goosebumps.fm'
          }
        ]
      }
    }

    const seoData = generateTrackSEO(loaderData.track, params.trackId)
    return {
      meta: generateSEOMeta(seoData)
    }
  }
})

function TrackPage() {
  const { trackId } = Route.useParams()
  const { track: data } = Route.useLoaderData()
  const { setCurrentContent } = useContentStore()

  React.useEffect(() => {
    if (data?.creators) {
      const contentInfo = {
        id: trackId,
        archetype: 'track',
        creatorIds: data.creators.map((creator) => creator.id)
      }
      setCurrentContent(contentInfo)
    }

    return () => setCurrentContent(null)
  }, [data, trackId, setCurrentContent])

  if (!data) return <div>No data</div>

  return (
    <LongPost
      title={data.title}
      description={data.description ?? ''}
      content={data.compiledContent ?? data.content}
      thumbnailUrl={data.thumbnailUrl ?? ''}
      date={data.createdAt}
      mp3Url={data.url}
      slug={trackId}
      shareType='track'
    />
  )
}
