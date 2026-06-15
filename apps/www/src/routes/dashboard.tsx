import { createFileRoute } from '@tanstack/react-router'
import {
  DashboardSettings,
  FavoritesSection,
  RemindersCard,
  WelcomeHeader
} from '@/components/dashboard'
import { useSession } from '@/lib/auth-client'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.dashboard)
  })
})

function Dashboard() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className='flex items-center justify-center min-h-[50vh] p-4 font-jetbrains'>
        <div className='text-muted-foreground'>Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className='flex items-center justify-center min-h-[50vh] p-4 font-jetbrains'>
        <div className='text-center'>
          <p className='mb-4 text-lg text-muted-foreground'>
            Please sign in to access your dashboard
          </p>
          <a
            href='/auth/sign-in'
            className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-none bg-primary text-primary-foreground hover:bg-primary/90'>
            Sign In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className='px-4 py-6 sm:px-6 sm:py-12 mx-auto space-y-10 sm:space-y-16 max-w-7xl font-jetbrains'>
      <WelcomeHeader user={session.user} />

      <div className='grid grid-cols-1 gap-8 sm:gap-12 lg:grid-cols-12'>
        <div className='lg:col-span-8'>
          <FavoritesSection />
        </div>
        <div className='lg:col-span-4'>
          <RemindersCard />
        </div>
      </div>

      <DashboardSettings user={session.user} />
    </div>
  )
}
