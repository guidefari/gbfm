import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { LongPost } from '@/components/Layout/LongPost'
import { RouteError } from '@/components/RouteError'
import { getApiClient } from '@/lib/api-client'
import { generateSEOHead, generateTrackSEO, notFoundHead } from '@/lib/seo'
import { captureException } from '@/services/analytics'

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
      return notFoundHead('Track', 'Listen to individual tracks on goosebumps.fm')
    }
    return generateSEOHead(generateTrackSEO(loaderData.track, params.trackId))
  }
})

function TrackPage() {
  const { trackId } = Route.useParams()
  const { track: data } = Route.useLoaderData()

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
