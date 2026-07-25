import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import * as React from 'react'
import { LongPost } from '@/components/Layout/LongPost'
import { RouteError } from '@/components/RouteError'
import { getApiClient } from '@/lib/api-client'
import { generateSEOMeta, generateTrackSEO } from '@/lib/seo'
import { captureException } from '@/services/analytics'
import { useSetCurrentContent } from '@/store'

export const Route = createFileRoute('/tracks/$trackId')({
  component: TrackPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
  loader: async ({ params }) => {
    const client = await getApiClient()
    const track = await Effect.runPromise(
      client.audio
        .getAudioBySlug({ params: { type: 'track', slug: params.trackId } })
        .pipe(
          Effect.tapError((error) => captureException(error, { endpoint: 'audio.getAudioBySlug' }))
        )
    )
    return {
      track: {
        ...track,
        bannerImageUrl: null,
        createdAt: new Date(track.createdAt),
        updatedAt: new Date(track.updatedAt),
        tags: track.tags ? [...track.tags] : null,
        creators: track.creators ? [...track.creators] : undefined
      }
    }
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
  const setCurrentContent = useSetCurrentContent()

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
