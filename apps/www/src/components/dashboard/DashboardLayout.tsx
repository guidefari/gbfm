import { Home, Mail, Music, Palette, User as UserIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  SidebarLayout,
  SidebarNavGroup,
  type SidebarNavItem,
  SidebarNavLink
} from '@/components/Layout/SidebarLayout'
import { useSession } from '@/lib/auth-client'

const settingsNavItems: SidebarNavItem[] = [
  { to: '/dashboard/profile', label: 'Account Profile', icon: UserIcon },
  { to: '/dashboard/appearance', label: 'Appearance', icon: Palette },
  { to: '/dashboard/player', label: 'Player Settings', icon: Music },
  { to: '/dashboard/email', label: 'Email Notifications', icon: Mail }
]

function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <SidebarNavLink
        item={{ to: '/dashboard', label: 'Home', icon: Home }}
        onNavigate={onNavigate}
      />
      <SidebarNavGroup title='Settings' items={settingsNavItems} onNavigate={onNavigate} />
    </>
  )
}

export function DashboardLayout({
  title,
  description,
  actions,
  children
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
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
    <div className='font-jetbrains'>
      <SidebarLayout
        brand='Dashboard'
        nav={DashboardNav}
        title={title}
        description={description}
        actions={actions}>
        {children}
      </SidebarLayout>
    </div>
  )
}
