import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { AdminPage } from './_components/-AdminLayout'
import { PlaylistsTab } from './_components/-PlaylistsTab'

export const Route = createFileRoute('/dashboard/playlists')({
  component: AdminPlaylistsPage
})

export const Page = createPageComponent(Route)

function AdminPlaylistsPage() {
  return (
    <AdminPage
      title='Playlist Management'
      description='Import Spotify playlists, edit metadata, and reorder tracks.'
      backToAdmin>
      <PlaylistsTab />
    </AdminPage>
  )
}
