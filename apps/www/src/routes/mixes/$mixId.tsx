import type { SelectMdxCompiledAudio } from '@gbfm/vps/schemas'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Edit } from 'lucide-react'
import * as React from 'react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { Button } from '@/components/ui/button'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { useContentStore } from '@/store'
import { useAuthStore } from '@/store/auth'

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
    if (mix?.creators) {
      const contentInfo = {
        id: mixId,
        archetype: 'mix',
        creatorIds: mix.creators.map((creator) => creator.id)
      }
      setCurrentContent(contentInfo)
    }

    return () => setCurrentContent(null)
  }, [mix, mixId, setCurrentContent])

  if (!mix) return <div>No data</div>

  return (
    <div className='max-w-3xl mx-auto px-4 py-6'>
      <Link
        to='/mixes'
        className='inline-flex items-center gap-1 mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors'>
        <ArrowLeft className='w-4 h-4' />
        Mixes
      </Link>
      <MixDetails mix={mix} />
    </div>
  )
}

function MixDetails({ mix }: { mix: SelectMdxCompiledAudio }) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  const handleEdit = () => {
    navigate({
      to: '/mix-upload',
      search: {
        edit: mix.slug,
        title: mix.title,
        description: mix.description || '',
        content: mix.content || '',
        thumbnailUrl: mix.thumbnailUrl || '',
        tags: mix.tags || []
      }
    })
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <h2 className='mb-2 text-2xl font-bold'>{mix.title}</h2>
          {mix.description && (
            <p className='text-sm text-muted-foreground'>{mix.description}</p>
          )}
          {mix.createdAt && (
            <p className='mt-2 text-xs text-muted-foreground'>
              {new Date(mix.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )}
        </div>
        {isAdmin && (
          <Button
            onClick={handleEdit}
            variant='outline'
            size='sm'
            className='flex items-center gap-2'>
            <Edit className='w-4 h-4' />
            Edit Mix
          </Button>
        )}
      </div>

      <div className='prose prose-sm dark:prose-invert max-w-none'>
        <MDXRendrr mdxString={mix.compiledContent ?? mix.content} />
      </div>
    </div>
  )
}
