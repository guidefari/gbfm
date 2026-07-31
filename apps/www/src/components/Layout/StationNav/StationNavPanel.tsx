import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LayoutDashboard, LogIn, LogOut } from 'lucide-react'
import { useCallback } from 'react'
import { signOut } from '@/lib/auth-client'
import { useNowPlayingTrack } from '@/services/player'
import { useUIActions } from '@/store/ui'
import { NavItemLink, navRowClass, NavSection } from './NavItemLink'
import { NowPlayingMini } from './NowPlayingMini'
import { StationList } from './StationList'
import { useNavSections } from './useNavSections'

const iconClass = 'h-5 w-5'

export function StationNavPanel({
  activeStationSlug,
  onNavigate
}: {
  activeStationSlug?: string
  onNavigate?: () => void
}) {
  const { isAuthenticated, browse, create, admin, utility } = useNavSections()
  const currentTrack = useNowPlayingTrack()
  const location = useLocation()
  const navigate = useNavigate()
  const { resetUI } = useUIActions()

  const handleSignOut = useCallback(async () => {
    onNavigate?.()
    await signOut()
    resetUI()
    navigate({ to: '/' })
  }, [onNavigate, resetUI, navigate])

  return (
    <div className='flex flex-col gap-6'>
      {currentTrack && (
        <NavSection title='Now playing'>
          <NowPlayingMini onClose={onNavigate} />
        </NavSection>
      )}

      <NavSection title='Stations'>
        <StationList activeSlug={activeStationSlug} onNavigate={onNavigate} />
      </NavSection>

      <NavSection title='Browse'>
        {browse.map((item) => (
          <NavItemLink key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </NavSection>

      {create.length > 0 && (
        <NavSection title='Create'>
          {create.map((item) => (
            <NavItemLink key={item.id} item={item} onNavigate={onNavigate} />
          ))}
        </NavSection>
      )}

      <NavSection title='Account'>
        {isAuthenticated ? (
          <>
            <Link to='/dashboard' onClick={onNavigate} className={navRowClass}>
              <LayoutDashboard className={iconClass} />
              <span className='min-w-0 flex-1 truncate'>Dashboard</span>
            </Link>
            {admin.map((item) => (
              <NavItemLink key={item.id} item={item} onNavigate={onNavigate} />
            ))}
            <button type='button' onClick={handleSignOut} className={navRowClass}>
              <LogOut className={iconClass} />
              <span className='min-w-0 flex-1 truncate text-left'>Log out</span>
            </button>
          </>
        ) : (
          <Link
            to='/auth/sign-in'
            search={{ redirect: location.pathname }}
            onClick={onNavigate}
            className={navRowClass}>
            <LogIn className={iconClass} />
            <span className='min-w-0 flex-1 truncate'>Log in</span>
          </Link>
        )}
      </NavSection>

      <NavSection title='Follow'>
        {utility.map((item) => (
          <NavItemLink key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </NavSection>
    </div>
  )
}
