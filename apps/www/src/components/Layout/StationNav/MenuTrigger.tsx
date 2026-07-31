import { Command } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavMenu } from './nav-menu-context'

export function MenuTrigger({
  className,
  showShortcut = true
}: {
  className?: string
  showShortcut?: boolean
}) {
  const { openMenu, isMenuOpen } = useNavMenu()

  return (
    <button
      type='button'
      onClick={openMenu}
      aria-label='Open menu'
      aria-expanded={isMenuOpen}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-xs font-semibold tracking-wide transition-colors',
        'text-muted-foreground hover:border-foreground/40 hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isMenuOpen && 'border-highlight text-highlight',
        className
      )}>
      <Command className='h-3.5 w-3.5' strokeWidth={1.75} />
      <span>Menu</span>
      {showShortcut ? (
        <kbd className='hidden rounded border border-border px-1 py-px font-mono text-[10px] text-muted-foreground xl:inline'>
          ⌘K
        </kbd>
      ) : null}
    </button>
  )
}
