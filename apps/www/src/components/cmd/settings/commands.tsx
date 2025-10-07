import { LogOut, User } from 'lucide-react'
import { CommandItem, CommandShortcut } from '@/components/ui/command'

interface SettingsCommandsProps {
  onNavigateToProfile: () => void
  onLogout: () => void
}

export const SettingsCommands = ({
  onNavigateToProfile,
  onLogout
}: SettingsCommandsProps) => {
  return (
    <>
      <CommandItem onSelect={onNavigateToProfile}>
        <User />
        <span>Profile</span>
        <CommandShortcut>⌘P</CommandShortcut>
      </CommandItem>

      <CommandItem onSelect={onLogout}>
        <LogOut />
        <span>Logout</span>
        <CommandShortcut>⌘L</CommandShortcut>
      </CommandItem>
    </>
  )
}
