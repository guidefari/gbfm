import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { SpotifyConnectionCard } from '@/components/spotify/SpotifyConnectionCard'

export const Route = createFileRoute('/dashboard/integrations')({
  component: DashboardIntegrations
})

export const Page = createPageComponent(Route)

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
