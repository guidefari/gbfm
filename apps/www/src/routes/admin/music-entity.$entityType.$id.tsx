import type { MusicEntityType } from '@gbfm/ui'
import { Button } from '@gbfm/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'
import { MusicEntityDetailPage } from './_components/-MusicEntityDetailPage'

export const Route = createFileRoute('/admin/music-entity/$entityType/$id')({
  component: MusicDetailRoute
})

const VALID_TYPES: MusicEntityType[] = ['artist', 'album', 'track', 'playlist']

function MusicDetailRoute() {
  const { entityType, id } = Route.useParams()

  if (!VALID_TYPES.includes(entityType as MusicEntityType)) {
    return (
      <AdminAccessGuard>
        <p className='p-8 text-muted-foreground'>
          Unknown entity type: {entityType}
        </p>
      </AdminAccessGuard>
    )
  }

  return (
    <AdminAccessGuard>
      <div className='flex flex-col min-h-[calc(100vh-8rem)]'>
        <header className='flex items-center gap-4 px-6 py-4 border-b shrink-0'>
          <Button asChild variant='ghost' size='sm'>
            <Link to='/admin/music'>
              <ArrowLeft className='w-4 h-4 mr-1' />
              Music catalog
            </Link>
          </Button>
        </header>
        <div className='flex-1 p-6 max-w-4xl mx-auto w-full'>
          <MusicEntityDetailPage
            entityType={entityType as MusicEntityType}
            id={id}
          />
        </div>
      </div>
    </AdminAccessGuard>
  )
}
