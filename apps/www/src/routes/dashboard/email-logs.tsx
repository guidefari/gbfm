import { Card, CardContent } from '@gbfm/ui'
import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { EmailLogsTab } from './_components/-EmailLogsTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/dashboard/email-logs')({
  component: AdminEmailLogsPage
})

export const Page = createPageComponent(Route)

function AdminEmailLogsPage() {
  return (
    <AdminPage
      title='Email Logs'
      description='Review delivery outcomes, investigate failures, and understand recent email operations.'
      backToAdmin>
      <Card>
        <CardContent className='pt-6'>
          <EmailLogsTab />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
