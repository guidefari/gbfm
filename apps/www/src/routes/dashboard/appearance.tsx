import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { ThemePreferencesCard } from '@/components/dashboard/ThemePreferencesCard'

export const Route = createFileRoute('/dashboard/appearance')({
  component: DashboardAppearance
})

export const Page = createPageComponent(Route)

function DashboardAppearance() {
  return (
    <DashboardLayout title='Appearance' description='Customize how goosebumps.fm looks for you.'>
      <ThemePreferencesCard />
    </DashboardLayout>
  )
}
