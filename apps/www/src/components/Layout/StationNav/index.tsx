import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@gbfm/ui'
import { useHotkey } from '@tanstack/react-hotkeys'
import { Link, useLocation } from '@tanstack/react-router'
import { Radio } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useVisibility } from '@/services/player'
import { StationNavPanel } from './StationNavPanel'

export function StationNav({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const { isFullscreenVisible } = useVisibility()
  const location = useLocation()

  const close = useCallback(() => setIsOpen(false), [])

  useHotkey('Mod+K', () => setIsOpen((prev) => !prev))

  useEffect(() => {
    close()
  }, [close, location.href])

  if (isFullscreenVisible) return null

  const search: Record<string, unknown> = location.search
  const showParam = search.show
  const activeStationSlug =
    location.pathname === '/shows' && typeof showParam === 'string' ? showParam : undefined

  return (
    <div
      className={cn(
        'flex items-stretch border border-border bg-background/95 shadow-lg backdrop-blur',
        className
      )}>
      <Link
        to='/'
        className='flex items-center px-3 text-sm font-black tracking-tight text-foreground transition-colors hover:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
        gbfm
      </Link>

      <span aria-hidden className='my-2 w-px bg-border' />

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger
          className={cn(
            'flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-foreground transition-colors',
            'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}>
          <Radio className='h-4 w-4 text-highlight' />
          <span>Stations</span>
        </SheetTrigger>
        <SheetContent side='right' className='w-80 max-w-[85vw] p-0'>
          <SheetTitle className='border-b border-border px-4 py-4 text-sm font-black tracking-tight'>
            goosebumps.fm
          </SheetTitle>
          <div className='h-[calc(100dvh-3.5rem)] overflow-y-auto'>
            <nav aria-label='Site navigation' className='p-3 pb-24'>
              <StationNavPanel activeStationSlug={activeStationSlug} onNavigate={close} />
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
