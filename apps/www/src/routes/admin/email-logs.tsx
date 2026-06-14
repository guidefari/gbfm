import { Card, CardContent } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { EmailLogsTab } from './_components/-EmailLogsTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/admin/email-logs')({
  component: AdminEmailLogsPage
})

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
