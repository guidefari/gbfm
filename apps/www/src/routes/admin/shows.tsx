import { Card, CardContent } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { ShowsTab } from './_components/-ShowsTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/admin/shows')({
  component: AdminShowsPage
})

function AdminShowsPage() {
  return (
    <AdminPage
      title='Shows'
      description='Create, edit, and publish shows while managing host attribution and metadata.'
      backToAdmin>
      <Card>
        <CardContent className='pt-6'>
          <ShowsTab />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
