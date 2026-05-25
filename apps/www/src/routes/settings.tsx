import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ChevronLeft,
  type LucideIcon,
  Mail,
  Music,
  Palette,
  Settings,
  User as UserIcon
} from 'lucide-react'
import { useState } from 'react'
import {
  ChangePasswordCard,
  EmailPreferencesCard,
  PlayerPreferencesCard,
  ProfileCard,
  ThemePreferencesCard
} from '@/components/dashboard'
import { useSession } from '@/lib/auth-client'

export const Route = createFileRoute('/settings')({
  component: SettingsPage
})

function SettingsPage() {
  const { data: session, isPending } = useSession()
  const [activeSettingTab, setActiveSettingTab] = useState<
    'profile' | 'appearance' | 'player' | 'email'
  >('profile')

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
          <p className='mb-4 text-lg text-muted-foreground font-jetbrains'>
            Please sign in to access your settings
          </p>
          <a
            href='/auth/sign-in'
            className='inline-flex items-center justify-center px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-none bg-primary text-primary-foreground hover:bg-primary/90 transition-all'>
            Sign In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-7xl mx-auto px-6 py-12 space-y-12 font-jetbrains'>
      <div className='flex items-center justify-between'>
        <div className='space-y-2'>
          <h1 className='text-4xl font-black uppercase tracking-tighter flex items-center gap-4'>
            <Settings className='w-10 h-10 text-primary' />
            Settings
          </h1>
          <p className='text-muted-foreground font-medium uppercase tracking-widest text-xs'>
            Manage your account and app preferences
          </p>
        </div>
        <Link
          to='/dashboard'
          className='flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest border-2 border-border hover:bg-accent hover:border-accent transition-all'>
          <ChevronLeft className='w-4 h-4' />
          Dashboard
        </Link>
      </div>

      <div className='pt-12 border-t border-border'>
        <div className='flex flex-col lg:flex-row gap-12'>
          {/* Settings Nav */}
          <div className='lg:w-64 shrink-0'>
            <nav className='flex flex-col gap-1'>
              <SettingNavButton
                active={activeSettingTab === 'profile'}
                onClick={() => setActiveSettingTab('profile')}
                icon={UserIcon}
                label='Account Profile'
              />
              <SettingNavButton
                active={activeSettingTab === 'appearance'}
                onClick={() => setActiveSettingTab('appearance')}
                icon={Palette}
                label='Appearance'
              />
              <SettingNavButton
                active={activeSettingTab === 'player'}
                onClick={() => setActiveSettingTab('player')}
                icon={Music}
                label='Player Settings'
              />
              <SettingNavButton
                active={activeSettingTab === 'email'}
                onClick={() => setActiveSettingTab('email')}
                icon={Mail}
                label='Email Notifications'
              />
            </nav>
          </div>

          {/* Settings Content */}
          <div className='flex-1 border-l border-border pl-12 min-h-[500px]'>
            {activeSettingTab === 'profile' && (
              <div className='animate-in fade-in slide-in-from-left-2 duration-300 space-y-6'>
                <ProfileCard user={session.user} />
                <ChangePasswordCard email={session.user.email} />
              </div>
            )}
            {activeSettingTab === 'appearance' && (
              <div className='animate-in fade-in slide-in-from-left-2 duration-300'>
                <ThemePreferencesCard />
              </div>
            )}
            {activeSettingTab === 'player' && (
              <div className='animate-in fade-in slide-in-from-left-2 duration-300'>
                <PlayerPreferencesCard />
              </div>
            )}
            {activeSettingTab === 'email' && (
              <div className='animate-in fade-in slide-in-from-left-2 duration-300'>
                <EmailPreferencesCard />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingNavButton({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-4 text-sm font-bold uppercase tracking-widest transition-all duration-200 border-l-2
        ${
          active
            ? 'bg-muted border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }
      `}>
      <Icon className={`w-4 h-4 ${active ? 'text-primary' : ''}`} />
      {label}
    </button>
  )
}
