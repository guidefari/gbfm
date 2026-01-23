import { createFileRoute } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import {
  EmailPreferencesCard,
  FavoritesSection,
  PlayerPreferencesCard,
  ProfileCard,
  QuickActions,
  RecentMixesSection,
  RemindersCard,
  WelcomeHeader
} from '@/components/dashboard'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { useSession } from '@/lib/auth-client'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard
})

function Dashboard() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className='flex items-center justify-center min-h-[50vh] p-4'>
        <div className='text-muted-foreground'>Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className='flex items-center justify-center min-h-[50vh] p-4'>
        <div className='text-center'>
          <p className='mb-4 text-lg text-muted-foreground'>
            Please sign in to access your dashboard
          </p>
          <a
            href='/auth/sign-in'
            className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90'>
            Sign In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-6xl mx-auto px-6 py-12 space-y-16'>
      <div className='space-y-10'>
        <WelcomeHeader user={session.user} />
        <QuickActions />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-12'>
        {/* Main Column */}
        <div className='lg:col-span-8 space-y-12'>
          <RecentMixesSection />
        </div>

        {/* Sidebar */}
        <div className='lg:col-span-4 space-y-10'>
          <RemindersCard />
          <FavoritesSection />
        </div>
      </div>

      <div className='pt-8 border-t border-border/50'>
        <Accordion type='single' collapsible className='w-full'>
          <AccordionItem value='settings' className='border-b-0'>
            <AccordionTrigger className='hover:no-underline py-4 px-6 bg-muted/20 rounded-xl hover:bg-muted/30 transition-all'>
              <span className='flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider'>
                <Settings className='w-4 h-4' />
                Settings & Preferences
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8'>
                <ProfileCard user={session.user} />
                <PlayerPreferencesCard />
                <EmailPreferencesCard />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}
