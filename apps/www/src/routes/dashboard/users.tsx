import { Card, CardContent } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { UsersTab } from './_components/-UsersTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/dashboard/users')({
  component: AdminUsersPage
})

function AdminUsersPage() {
  return (
    <AdminPage
      title='Users'
      description='Manage accounts, roles, bans, onboarding state, and profile metadata.'
      backToAdmin>
      <Card>
        <CardContent className='pt-6'>
          <UsersTab />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
