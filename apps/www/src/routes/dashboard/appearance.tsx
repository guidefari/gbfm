import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { ThemePreferencesCard } from '@/components/dashboard/ThemePreferencesCard'

export const Route = createFileRoute('/dashboard/appearance')({
  component: DashboardAppearance
})

function DashboardAppearance() {
  return (
    <DashboardLayout title='Appearance' description='Customize how goosebumps.fm looks for you.'>
      <ThemePreferencesCard />
    </DashboardLayout>
  )
}
