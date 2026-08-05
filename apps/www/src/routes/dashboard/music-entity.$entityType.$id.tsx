import type { MusicEntityType } from '@gbfm/ui'
import { Button } from '@gbfm/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'
import { MusicEntityDetailPage } from './_components/-MusicEntityDetailPage'

export const Route = createFileRoute('/dashboard/music-entity/$entityType/$id')({
  component: MusicDetailRoute
})

const VALID_TYPES: MusicEntityType[] = ['artist', 'album', 'track', 'playlist', 'label']

function isMusicEntityType(value: string): value is MusicEntityType {
  return VALID_TYPES.some((type) => type === value)
}

function MusicDetailRoute() {
  const { entityType, id } = Route.useParams()

  if (!isMusicEntityType(entityType)) {
    return (
      <AdminAccessGuard>
        <p className='p-8 text-muted-foreground'>Unknown entity type: {entityType}</p>
      </AdminAccessGuard>
    )
  }

  return (
    <AdminAccessGuard>
      <div className='flex flex-col min-h-[calc(100vh-8rem)]'>
        <header className='flex items-center gap-4 px-6 py-4 border-b shrink-0'>
          <Button asChild variant='ghost' size='sm'>
            <Link to='/dashboard/music'>
              <ArrowLeft className='w-4 h-4 mr-1' />
              Music catalog
            </Link>
          </Button>
        </header>
        <div className='flex-1 p-6 max-w-4xl mx-auto w-full'>
          <MusicEntityDetailPage entityType={entityType} id={id} />
        </div>
      </div>
    </AdminAccessGuard>
  )
}
