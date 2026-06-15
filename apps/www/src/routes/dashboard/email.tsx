import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { EmailPreferencesCard } from '@/components/dashboard/EmailPreferencesCard'

export const Route = createFileRoute('/dashboard/email')({
  component: DashboardEmail
})

function DashboardEmail() {
  return (
    <DashboardLayout
      title='Email Notifications'
      description='Choose which emails you want to receive.'>
      <EmailPreferencesCard />
    </DashboardLayout>
  )
}
