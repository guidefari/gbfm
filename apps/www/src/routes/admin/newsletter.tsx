import { Card, CardContent } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { NewsletterTab } from './_components/-NewsletterTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/admin/newsletter')({
  component: AdminNewsletterPage
})

function AdminNewsletterPage() {
  return (
    <AdminPage
      title='Newsletter'
      description='Manage subscriber audience visibility and shape campaign ideas around published content.'
      backToAdmin>
      <Card>
        <CardContent className='pt-6'>
          <NewsletterTab />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
