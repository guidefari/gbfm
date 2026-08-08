import { Card, CardContent } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { SessionsTab } from './_components/-SessionsTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/dashboard/sessions')({
  component: AdminSessionsPage
})

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
