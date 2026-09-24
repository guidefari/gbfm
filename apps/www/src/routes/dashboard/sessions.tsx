import { Card, CardContent } from '@gbfm/ui'
import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { SessionsTab } from './_components/-SessionsTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/dashboard/sessions')({
  component: AdminSessionsPage
})

export const Page = createPageComponent(Route)

function AdminSessionsPage() {
  return (
    <AdminPage
      title='Sessions'
      description='Inspect active sessions and track account access activity.'
      backToAdmin>
      <Card>
        <CardContent className='pt-6'>
          <SessionsTab />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
