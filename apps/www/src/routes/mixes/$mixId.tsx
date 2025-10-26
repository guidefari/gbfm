import type { SelectMdxCompiledAudio } from '@gbfm/vps/schemas'
import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { LongPost } from '@/components/Layout/LongPost'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { useContentStore } from '@/store'

export const Route = createFileRoute('/mixes/$mixId')({
  component: MixPage,
  loader: async ({ params }) => {
    const mix = await fetcher<SelectMdxCompiledAudio>(
      `${VPS_BASE_URL}/content/audio/mix/${params.mixId}`
    )
    return { mix }
  },
  head: ({ loaderData, params }) => {
    const siteUrl = 'https://goosebumps.fm'
    const mixUrl = `${siteUrl}/mixes/${params.mixId}`
    const mix = loaderData?.mix

    const title = mix?.title || params.mixId
    const description =
      mix?.description || `Listen to ${title} on goosebumps.fm`
    const image =
      mix?.thumbnailUrl ||
      'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'

    return {
      meta: [
        {
          title: `${title} | goosebumps.fm`
        },
        {
          name: 'description',
          content: description
        },
        {
          property: 'og:type',
          content: 'music.song'
        },
        {
          property: 'og:title',
          content: `${title} | goosebumps.fm`
        },
        {
          property: 'og:description',
          content: description
        },
        {
          property: 'og:url',
          content: mixUrl
        },
        {
          property: 'og:site_name',
          content: 'goosebumps.fm'
        },
        {
          property: 'og:image',
          content: image
        },
        {
          property: 'og:image:width',
          content: '1200'
        },
        {
          property: 'og:image:height',
          content: '630'
        },
        {
          property: 'og:audio',
          content: mix?.url || ''
        },
        {
          name: 'twitter:card',
          content: 'summary_large_image'
        },
        {
          name: 'twitter:title',
          content: `${title} | goosebumps.fm`
        },
        {
          name: 'twitter:description',
          content: description
        },
        {
          name: 'twitter:image',
          content: image
        }
      ]
    }
  }
})

function MixPage() {
  const { mixId } = Route.useParams()
  const { setCurrentContent } = useContentStore()
  const { mix } = Route.useLoaderData()

  React.useEffect(() => {
    if (mix?.authors) {
      const contentInfo = {
        id: mixId,
        archetype: 'mix',
        authorIds: mix.authors.map((author) => author.id)
      }
      setCurrentContent(contentInfo)
    }

    return () => setCurrentContent(null)
  }, [mix, mixId, setCurrentContent])

  if (!mix) return <div>No data</div>

  return (
    <LongPost
      title={mix.title}
      description={mix.description ?? ''}
      content={mix.compiledContent ?? mix.content}
      thumbnailUrl={mix.thumbnailUrl ?? ''}
      date={mix.createdAt}
      mp3Url={mix.url}
    />
  )
}
