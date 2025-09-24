import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { LongPost } from '@/components/Layout/LongPost'
import { MDXRendrr } from '@/components/MDXRendrr'
import { fetcher, useAudioBySlug, VPS_BASE_URL } from '@/lib/http'
import { useContentStore } from '@/store'

export const Route = createFileRoute('/read/$archetype/$id')({
  component: ReadSingle
})

function ReadSingle() {
  const { archetype, id } = Route.useParams()
  const { setCurrentContent } = useContentStore()

  // Handle audio content (mixes, tracks, etc) using the new endpoint
  const audioQuery = useAudioBySlug(archetype as 'mix' | 'track' | 'misc', id)

  // Handle MDX content (words, micro, etc) using the old endpoints
  const mdxQuery = useQuery({
    queryKey: ['read-single', archetype, id],
    staleTime: 2 * 60 * 1000,
    enabled: !['mix', 'track', 'misc'].includes(archetype), // Only run for non-audio content
    queryFn: async () => {
      if (archetype === 'words') {
        return fetcher(`${VPS_BASE_URL}/content/${id}`)
      }
      return fetcher(`${VPS_BASE_URL}/mdx-archive/read`, {
        method: 'POST',
        body: JSON.stringify({
          filename: `${archetype}/${id}.mdx`
        })
      })
    }
  })

  // Determine which query to use based on archetype
  const isAudioContent = ['mix', 'track', 'misc'].includes(archetype)
  const { data, error, isPending } = isAudioContent ? audioQuery : mdxQuery

  // Update content store when data is available
  React.useEffect(() => {
    console.log(
      'Read page effect - data:',
      data,
      'isAudioContent:',
      isAudioContent
    )
    if (data && isAudioContent && data.authors) {
      const contentInfo = {
        id,
        archetype,
        authorIds: data.authors.map((author: any) => author.id)
      }
      console.log('Setting current content:', contentInfo)
      setCurrentContent(contentInfo)
    } else if (data && !isAudioContent) {
      // For MDX content, we'll need to add author info later
      setCurrentContent(null)
    }

    // Clear content when leaving the page
    return () => setCurrentContent(null)
  }, [data, isAudioContent, id, archetype, setCurrentContent])

  if (isPending) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  if (!data) return <div>No data</div>
  console.log('data:', data)

  // Handle audio content (direct from database)
  if (isAudioContent) {
    return (
      <LongPost
        title={data.title}
        description={data.description}
        content={data.compiledContent ?? data.content}
        thumbnailUrl={data.thumbnailUrl}
        date={data.createdAt}
        mp3Url={data.url}
      />
    )
  }

  // Handle micro posts (MDX only)
  if (archetype === 'micro') {
    return <MDXRendrr mdxString={data.compiled as string} />
  }

  // Handle other MDX content (words, etc)
  return (
    <LongPost
      title={data.gray?.data.title ?? data.title}
      description={data.gray?.data.description ?? data.description}
      content={(data.compiled as string) ?? data.content}
      thumbnailUrl={data.gray?.data.thumbnailUrl ?? data.thumbnailUrl}
      date={data.gray?.data.date ?? data.date}
      youtubeId={data.gray?.data.youtubeId ?? data.youtubeId}
      mp3Url={data.gray?.data.mp3Url ?? data.mp3Url}
    />
  )
}
