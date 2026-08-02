import { Card, CardContent } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { ContentManager } from '@/components/content/ContentManager'
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
          <ContentManager scope='all' />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
