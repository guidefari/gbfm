import { Card, CardContent } from '@gbfm/ui'
import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { UsersTab } from './_components/-UsersTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/dashboard/users')({
  component: AdminUsersPage
})

export const Page = createPageComponent(Route)

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
