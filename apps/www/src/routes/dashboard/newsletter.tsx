import { Card, CardContent } from '@gbfm/ui'
import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { NewsletterTab } from './_components/-NewsletterTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/dashboard/newsletter')({
  component: AdminNewsletterPage
})

export const Page = createPageComponent(Route)

function AdminNewsletterPage() {
  return (
    <AdminPage
      title='Newsletter'
      description='Announce new mixes to subscribers and manage the audience.'
      backToAdmin>
      <Card>
        <CardContent className='pt-6'>
          <NewsletterTab />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
