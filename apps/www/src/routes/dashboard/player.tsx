import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { PlayerPreferencesCard } from '@/components/dashboard/PlayerPreferencesCard'

export const Route = createFileRoute('/dashboard/player')({
  component: DashboardPlayer
})

export const Page = createPageComponent(Route)

function DashboardPlayer() {
  return (
    <DashboardLayout title='Player Settings' description='Tune playback behavior to your taste.'>
      <div className='space-y-12'>
        <PlayerPreferencesCard />
      </div>
    </DashboardLayout>
  )
}
