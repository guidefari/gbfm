import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { ChangePasswordCard } from '@/components/dashboard/ChangePasswordCard'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { ProfileCard } from '@/components/dashboard/ProfileCard'
import { SocialLinksCard } from '@/components/dashboard/SocialLinksCard'
import { useSession } from '@/lib/auth-client'

export const Route = createFileRoute('/dashboard/profile')({
  component: DashboardProfile
})

export const Page = createPageComponent(Route)

function DashboardProfile() {
  const { data: session } = useSession()

  return (
    <DashboardLayout
      title='Account Profile'
      description='Manage your account details and password.'>
      {session?.user ? (
        <div className='space-y-6'>
          <ProfileCard user={session.user} />
          <SocialLinksCard />
          <ChangePasswordCard email={session.user.email} />
        </div>
      ) : null}
    </DashboardLayout>
  )
}
