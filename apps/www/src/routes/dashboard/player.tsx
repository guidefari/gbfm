import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { PlayerPreferencesCard } from '@/components/dashboard/PlayerPreferencesCard'

export const Route = createFileRoute('/dashboard/player')({
  component: DashboardPlayer
})

function DashboardPlayer() {
  return (
    <DashboardLayout title='Player Settings' description='Tune playback behavior to your taste.'>
      <PlayerPreferencesCard />
    </DashboardLayout>
  )
}
