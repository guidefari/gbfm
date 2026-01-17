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
      <div className='flex items-center justify-center min-h-screen p-4'>
        <div className='text-muted-foreground'>Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className='flex items-center justify-center min-h-screen p-4'>
        <div className='text-center'>
          <p className='text-lg text-muted-foreground mb-4'>
            Please sign in to access your dashboard
          </p>
          <a
            href='/auth/sign-in'
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90'>
            Sign In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className='p-4 mx-auto max-w-5xl space-y-6'>
      <WelcomeHeader user={session.user} />
      <QuickActions />
      <div className='grid gap-6 md:grid-cols-2'>
        <RemindersCard />
        <FavoritesSection />
      </div>
      <RecentMixesSection />

      <Accordion type='single' collapsible className='w-full'>
        <AccordionItem value='settings' className='border rounded-md px-4'>
          <AccordionTrigger className='hover:no-underline'>
            <span className='flex items-center gap-2 text-lg font-semibold'>
              <Settings className='w-5 h-5' />
              Settings
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className='space-y-6 pt-2'>
              <ProfileCard user={session.user} />
              <PlayerPreferencesCard />
              <EmailPreferencesCard />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
