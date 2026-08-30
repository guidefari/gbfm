import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

const VISIBLE_AFTER_MS = 400

export function NavigationStatus({ active, label }: { active: boolean; label: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return undefined
    }

    const handle = setTimeout(() => setVisible(true), VISIBLE_AFTER_MS)
    return () => clearTimeout(handle)
  }, [active])

  if (!visible) return null

  return (
    <div
      role='status'
      aria-live='polite'
      className='pointer-events-none absolute right-0 top-0 z-40 flex min-h-8 items-center gap-2 whitespace-nowrap rounded-sm border border-border/60 bg-background/95 px-3 py-1.5 font-mono text-xs text-muted-foreground shadow-lg backdrop-blur-sm lg:fixed lg:bottom-20 lg:left-1/2 lg:right-auto lg:top-auto lg:-translate-x-1/2'>
      <LoaderCircle aria-hidden className='h-3.5 w-3.5 motion-safe:animate-spin' />
      {label}
    </div>
  )
}
