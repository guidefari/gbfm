import { type LucideIcon, Mail, Music, Palette, User as UserIcon } from 'lucide-react'
import { useState } from 'react'
import type { useSession } from '@/lib/auth-client'
import { ChangePasswordCard } from './ChangePasswordCard'
import { EmailPreferencesCard } from './EmailPreferencesCard'
import { PlayerPreferencesCard } from './PlayerPreferencesCard'
import { ProfileCard } from './ProfileCard'
import { ThemePreferencesCard } from './ThemePreferencesCard'

type SessionUser = NonNullable<ReturnType<typeof useSession>['data']>['user']

const tabs = {
  profile: { icon: UserIcon, label: 'Account Profile' },
  appearance: { icon: Palette, label: 'Appearance' },
  player: { icon: Music, label: 'Player Settings' },
  email: { icon: Mail, label: 'Email Notifications' }
} as const

type SettingsTab = keyof typeof tabs

const tabKeys: SettingsTab[] = ['profile', 'appearance', 'player', 'email']

export function DashboardSettings({ user }: { user: SessionUser }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  return (
    <section className='pt-8 sm:pt-12 border-t border-border/30'>
      <h2 className='flex items-center gap-2 mb-8 text-sm font-bold tracking-widest text-muted-foreground'>
        Settings
      </h2>

      <div className='flex flex-col lg:flex-row gap-8 lg:gap-12'>
        <div className='lg:w-64 shrink-0'>
          <nav className='flex flex-col gap-1'>
            {tabKeys.map((tab) => (
              <SettingNavButton
                key={tab}
                active={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                icon={tabs[tab].icon}
                label={tabs[tab].label}
              />
            ))}
          </nav>
        </div>

        <div className='flex-1 lg:border-l lg:border-border lg:pl-12 min-h-[400px]'>
          {activeTab === 'profile' && (
            <div className='animate-in fade-in slide-in-from-left-2 duration-300 space-y-6'>
              <ProfileCard user={user} />
              <ChangePasswordCard email={user.email} />
            </div>
          )}
          {activeTab === 'appearance' && (
            <div className='animate-in fade-in slide-in-from-left-2 duration-300'>
              <ThemePreferencesCard />
            </div>
          )}
          {activeTab === 'player' && (
            <div className='animate-in fade-in slide-in-from-left-2 duration-300'>
              <PlayerPreferencesCard />
            </div>
          )}
          {activeTab === 'email' && (
            <div className='animate-in fade-in slide-in-from-left-2 duration-300'>
              <EmailPreferencesCard />
            </div>
          )}
        </div>
      </div>
    </section>
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
        flex items-center gap-3 px-4 py-4 text-sm font-bold tracking-widest transition-all duration-200 border-l-2
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
