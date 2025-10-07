import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { LongPost } from '@/components/Layout/LongPost'
import { useAudioBySlug } from '@/lib/http'
import { useContentStore } from '@/store'

export const Route = createFileRoute('/tracks/$trackId')({
  component: TrackPage
})

function TrackPage() {
  const { trackId } = Route.useParams()
  const { setCurrentContent } = useContentStore()

  const { data, error, isPending } = useAudioBySlug('track', trackId)

  React.useEffect(() => {
    if (data?.authors) {
      const contentInfo = {
        id: trackId,
        archetype: 'track',
        authorIds: data.authors.map((author: any) => author.id)
      }
      setCurrentContent(contentInfo)
    }

    return () => setCurrentContent(null)
  }, [data, trackId, setCurrentContent])

  if (isPending) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!data) return <div>No data</div>

  return (
    <LongPost
      title={data.title}
      description={data.description ?? ''}
      content={data.compiledContent ?? data.content}
      thumbnailUrl={data.thumbnailUrl ?? ''}
      date={data.createdAt}
      mp3Url={data.url}
    />
  )
}
