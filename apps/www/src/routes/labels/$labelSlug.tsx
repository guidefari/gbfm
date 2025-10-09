import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { LongPost } from '@/components/Layout/LongPost'
import { useLabelBySlug } from '@/lib/http'
import { useContentStore } from '@/store'

export const Route = createFileRoute('/labels/$labelSlug')({
  component: LabelPage
})

function LabelPage() {
  const { labelSlug } = Route.useParams()
  const { setCurrentContent } = useContentStore()

  const { data, error, isPending } = useLabelBySlug(labelSlug)

  React.useEffect(() => {
    if (data?.authors) {
      const contentInfo = {
        id: labelSlug,
        archetype: 'label',
        authorIds: data.authors.map((author) => author.id)
      }
      setCurrentContent(contentInfo)
    }

    return () => setCurrentContent(null)
  }, [data, labelSlug, setCurrentContent])

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
        date={data.createdAt}
      />
      {(data.website || data.bandcamp || data.discogs) && (
        <div className='px-4 py-6 border-t border-border mt-8'>
          <h3 className='text-lg font-semibold mb-4'>Links</h3>
          <div className='flex flex-wrap gap-3'>
            {data.website && (
              <a
                href={data.website}
                target='_blank'
                rel='noopener noreferrer'
                className='px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors text-sm font-medium'>
                Website
              </a>
            )}
            {data.bandcamp && (
              <a
                href={data.bandcamp}
                target='_blank'
                rel='noopener noreferrer'
                className='px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors text-sm font-medium'>
                Bandcamp
              </a>
            )}
            {data.discogs && (
              <a
                href={data.discogs}
                target='_blank'
                rel='noopener noreferrer'
                className='px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors text-sm font-medium'>
                Discogs
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
