import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'
import { PlaylistsTab } from './_components/-PlaylistsTab'

export const Route = createFileRoute('/admin/playlists')({
  component: AdminPlaylistsPage
})

function AdminPlaylistsPage() {
  return (
    <AdminAccessGuard>
      <div className='flex flex-col h-[calc(100vh-8rem)]'>
        <header className='flex items-center justify-between gap-4 px-6 py-4 border-b shrink-0'>
          <div>
            <h1 className='text-xl font-bold'>Playlist management</h1>
            <p className='text-xs text-muted-foreground'>
              Import Spotify playlists, edit metadata, and reorder tracks.
            </p>
          </div>
          <Button asChild variant='outline' size='sm'>
            <Link to='/admin'>
              <ArrowLeft className='w-4 h-4 mr-2' />
              Back to admin
            </Link>
          </Button>
        </header>
        <div className='flex-1 min-h-0'>
          <PlaylistsTab />
        </div>
      </div>
    </AdminAccessGuard>
  )
}
