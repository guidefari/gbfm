import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { FavoritesSection } from '@/components/dashboard/FavoritesSection'
import { RemindersCard } from '@/components/dashboard/RemindersCard'
import { useSession } from '@/lib/auth-client'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardHome
})

function DashboardHome() {
  const { data: session } = useSession()
  const firstName = session?.user.name.split(' ')[0] || 'there'

  return (
    <DashboardLayout title={`Welcome back, ${firstName}`} description="Here's what's happening">
      <div className='grid grid-cols-1 gap-8 sm:gap-12 lg:grid-cols-12'>
        <div className='lg:col-span-8'>
          <FavoritesSection />
        </div>
        <div className='lg:col-span-4'>
          <RemindersCard />
        </div>
      </div>
    </DashboardLayout>
  )
}
