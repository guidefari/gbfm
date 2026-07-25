import { Card, CardContent } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { ContentTab } from './_components/-ContentTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/admin/content')({
  component: AdminContentPage
})

function AdminContentPage() {
  return (
    <AdminPage
      title='Content'
      description='Operate publishing across mixes, editorials, and tweets from one place.'
      backToAdmin>
      <Card>
        <CardContent className='pt-6'>
          <ContentTab />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
