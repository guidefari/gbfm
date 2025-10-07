import { Monitor, Moon, Sun } from 'lucide-react'
import { CommandItem, CommandShortcut } from '@/components/ui/command'

interface ThemeCommandsProps {
  currentTheme: 'light' | 'dark' | 'system'
  onSetLight: () => void
  onSetDark: () => void
  onSetSystem: () => void
}

export const ThemeCommands = ({
  currentTheme,
  onSetLight,
  onSetDark,
  onSetSystem
}: ThemeCommandsProps) => {
  return (
    <>
      <CommandItem onSelect={onSetLight} disabled={currentTheme === 'light'}>
        <Sun />
        <span>Light</span>
        {currentTheme === 'light' && <CommandShortcut>✓</CommandShortcut>}
      </CommandItem>

      <CommandItem onSelect={onSetDark} disabled={currentTheme === 'dark'}>
        <Moon />
        <span>Dark</span>
        {currentTheme === 'dark' && <CommandShortcut>✓</CommandShortcut>}
      </CommandItem>

      <CommandItem onSelect={onSetSystem} disabled={currentTheme === 'system'}>
        <Monitor />
        <span>System</span>
        {currentTheme === 'system' && <CommandShortcut>✓</CommandShortcut>}
      </CommandItem>
    </>
  )
}
