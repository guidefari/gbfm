import { Button } from '@gbfm/ui'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Effect } from 'effect'
import { Edit } from 'lucide-react'
import { useEffect } from 'react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { RouteError } from '@/components/RouteError'
import { ShareButton } from '@/components/ShareButton'
import { getApiClient } from '@/lib/api-client'
import { useSession } from '@/lib/auth-client'
import { generateLabelSEO, generateSEOMeta } from '@/lib/seo'
import { captureException } from '@/services/analytics'
import { useSetCurrentContent } from '@/store'

export const Route = createFileRoute('/labels/$labelSlug')({
  component: LabelPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
  loader: async ({ params }) => {
    const client = await getApiClient()
    const label = await Effect.runPromise(
      client.music
        .getLabelBySlug({ params: { slug: params.labelSlug } })
        .pipe(
          Effect.tapError((error) => captureException(error, { endpoint: 'music.getLabelBySlug' }))
        )
    )
    const links = await Effect.runPromise(
      client.music.listEntityLinks({
        params: { entityType: 'label', entityId: label.id },
        query: { status: 'verified' }
      })
    )
    return {
      label: {
        ...label,
        tags: label.tags ? [...label.tags] : null,
        genres: label.genres ? [...label.genres] : null,
        creators: label.creators ? [...label.creators] : undefined
      },
      links: links.map((link) => ({ ...link }))
    }
  },
  head: ({ loaderData, params }) => ({
    meta: loaderData?.label
      ? generateSEOMeta(generateLabelSEO(loaderData.label, params.labelSlug))
      : [
          { title: 'Label | goosebumps.fm' },
          { name: 'description', content: 'Explore music labels on goosebumps.fm' }
        ]
  })
})

function LabelPage() {
  const { labelSlug } = Route.useParams()
  const { label, links } = Route.useLoaderData()
  const setCurrentContent = useSetCurrentContent()
  const { data: session } = useSession()
  const navigate = useNavigate()
  const isAdmin = session?.user?.role === 'admin'

  useEffect(() => {
    setCurrentContent({
      id: label.id,
      archetype: 'label',
      creatorIds: label.creators?.map((creator) => creator.id) ?? []
    })

    return () => setCurrentContent(null)
  }, [label, setCurrentContent])

  return (
    <div className='mx-auto max-w-6xl'>
      {label.bannerImageUrl && (
        <img
          src={label.bannerImageUrl}
          alt=''
          className='mb-8 h-48 w-full rounded-sm object-cover sm:h-64'
        />
      )}
      <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
        <aside className='lg:col-span-1'>
          <div className='sticky top-6 space-y-6'>
            <img
              className='w-full rounded-sm'
              src={label.imageUrl || '/fav.png'}
              alt={`Artwork for ${label.name}`}
              width={400}
              height={400}
            />
            <div className='space-y-4'>
              <div className='flex items-start justify-between gap-3'>
                <h1 className='text-2xl font-bold'>{label.name}</h1>
                <div className='flex gap-2'>
                  <ShareButton type='label' slug={labelSlug} />
                  {isAdmin && (
                    <Button
                      onClick={() =>
                        navigate({
                          to: '/admin/music-entity/$entityType/$id',
                          params: { entityType: 'label', id: label.id }
                        })
                      }
                      variant='outline'
                      size='sm'>
                      <Edit className='mr-2 h-4 w-4' />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
              {label.description && <p className='text-muted-foreground'>{label.description}</p>}
              {label.genres && label.genres.length > 0 && (
                <p className='text-sm text-muted-foreground'>{label.genres.join(', ')}</p>
              )}
              {links.length > 0 && (
                <div>
                  <h2 className='mb-3 text-lg font-semibold'>Links</h2>
                  <div className='flex flex-col gap-2'>
                    {links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='rounded-sm bg-primary/10 px-4 py-2 text-sm font-medium capitalize transition-colors hover:bg-primary/20'>
                        {link.platform.replaceAll('_', ' ')}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
        <main className='prose prose-neutral max-w-none dark:prose-invert lg:col-span-2'>
          <MDXRendrr mdxString={label.compiledContent ?? label.content} />
        </main>
      </div>
    </div>
  )
}
