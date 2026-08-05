import { createFileRoute } from '@tanstack/react-router'
import { AdminPage } from './_components/-AdminLayout'
import { PlaylistsTab } from './_components/-PlaylistsTab'

export const Route = createFileRoute('/dashboard/playlists')({
  component: AdminPlaylistsPage
})

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
