import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, Settings } from 'lucide-react'
import {
  FavoritesSection,
  QuickActions,
  RecentMixesSection,
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
      <div className='space-y-6 sm:space-y-12'>
        <WelcomeHeader user={session.user} />
        <div>
          <QuickActions />
        </div>
      </div>

      <div className='grid grid-cols-1 gap-8 sm:gap-12 lg:grid-cols-12'>
        <div className='space-y-8 sm:space-y-16 lg:col-span-8'>
          <div>
            <FavoritesSection />
          </div>
          <RecentMixesSection />
        </div>

        <div className='hidden space-y-12 lg:col-span-4 lg:block'>
          <RemindersCard />
        </div>
        <div className='block space-y-12 lg:hidden'>
          <RemindersCard />
        </div>
      </div>

      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-8 sm:pt-12 border-t border-border/30'>
        <div className='space-y-1'>
          <h3 className='flex items-center gap-2 text-sm font-bold tracking-widest uppercase text-muted-foreground'>
            <Settings className='w-4 h-4' />
            Settings
          </h3>
          <p className='text-xs font-medium tracking-wider uppercase text-muted-foreground'>
            Profile, Player, and Notification preferences
          </p>
        </div>
        <Link
          to='/settings'
          className='flex items-center gap-2 px-6 py-3 text-xs font-bold tracking-widest uppercase transition-all border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground'>
          Manage Settings
          <ChevronRight className='w-4 h-4' />
        </Link>
      </div>
    </div>
  )
}
