import { Home, Headphones, Music, LockKeyhole } from 'lucide-react'
import { CommandItem, CommandShortcut } from '@/components/ui/command'

interface NavigationCommandsProps {
  isOnHomePage: boolean
  isAuthenticated: boolean
  onNavigateHome: () => void
  onNavigateToMixes: () => void
  onNavigateToTracks: () => void
  onNavigateToLogin: () => void
}

export const NavigationCommands = ({
  isOnHomePage,
  isAuthenticated,
  onNavigateHome,
  onNavigateToMixes,
  onNavigateToTracks,
  onNavigateToLogin
}: NavigationCommandsProps) => {
  return (
    <>
      {!isOnHomePage && (
        <CommandItem onSelect={onNavigateHome}>
          <Home />
          <span>Home</span>
        </CommandItem>
      )}
      <CommandItem onSelect={onNavigateToMixes}>
        <Headphones />
        <span>Mixes</span>
        <CommandShortcut>0</CommandShortcut>
      </CommandItem>
      <CommandItem onSelect={onNavigateToTracks}>
        <Music />
        <span>All Tracks</span>
      </CommandItem>
      {!isAuthenticated && (
        <CommandItem onSelect={onNavigateToLogin}>
          <LockKeyhole />
          <span>Login</span>
        </CommandItem>
      )}
    </>
  )
}
