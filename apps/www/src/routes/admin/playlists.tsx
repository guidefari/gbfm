import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'
import { PlaylistsTab } from './_components/-PlaylistsTab'

export const Route = createFileRoute('/admin/playlists')({
  component: AdminPlaylistsPage
})

function AdminPlaylistsPage() {
  return (
    <AdminAccessGuard>
      <div className='container max-w-6xl py-8 mx-auto'>
        <div className='flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-bold'>Playlist management</h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              Import Spotify playlists, edit metadata, and reorder tracks.
            </p>
          </div>
          <Button asChild variant='outline'>
            <Link to='/admin'>
              <ArrowLeft className='w-4 h-4 mr-2' />
              Back to admin
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Playlists</CardTitle>
          </CardHeader>
          <CardContent>
            <PlaylistsTab />
          </CardContent>
        </Card>
      </div>
    </AdminAccessGuard>
  )
}
