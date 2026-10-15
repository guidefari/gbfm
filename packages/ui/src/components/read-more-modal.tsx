import type React from 'react'
import { useCallback, useState, useSyncExternalStore } from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './sheet'

interface ReadMoreModalProps {
  title: string
  children: React.ReactNode
  trigger: React.ReactNode
}

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', listener)

      return () => media.removeEventListener('change', listener)
    },
    [query],
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function ReadMoreModal({ title, children, trigger }: ReadMoreModalProps) {
  const [open, setOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <button type='button' onClick={() => setOpen(true)}>
          {trigger}
        </button>
        <DialogContent className='max-w-xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className='prose prose-neutral dark:prose-invert prose-sm'>{children}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button type='button' onClick={() => setOpen(true)}>
        {trigger}
      </button>
      <SheetContent side='bottom' className='max-h-[85vh] overflow-y-auto rounded-t-xl'>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className='prose prose-neutral dark:prose-invert prose-sm mt-4'>{children}</div>
      </SheetContent>
    </Sheet>
  )
}
