import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { EmailPreferencesCard } from '@/components/dashboard/EmailPreferencesCard'

export const Route = createFileRoute('/dashboard/email')({
  component: DashboardEmail
})

export const Page = createPageComponent(Route)

function DashboardEmail() {
  return (
    <DashboardLayout
      title='Email Notifications'
      description='Choose which emails you want to receive.'>
      <EmailPreferencesCard />
    </DashboardLayout>
  )
}
