import { Card, CardContent } from '@gbfm/ui'
import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { ShowsTab } from './_components/-ShowsTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/dashboard/shows')({
  component: AdminShowsPage
})

export const Page = createPageComponent(Route)

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
