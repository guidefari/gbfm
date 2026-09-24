import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { SpotifyConnectionCard } from '@/components/spotify/SpotifyConnectionCard'

export const Route = createFileRoute('/dashboard/integrations')({
  component: DashboardIntegrations
})

function DashboardIntegrations() {
  return (
    <DashboardLayout
      title='Integrations'
      description='Connect the services Goosebumps uses for music.'>
      <div className='space-y-12'>
        <SpotifyConnectionCard />
      </div>
    </DashboardLayout>
  )
}
