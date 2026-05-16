import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@gbfm/ui'
import { useState } from 'react'
import { useIsDesktop } from '@/hooks/useMediaQuery'

interface ReadMoreModalProps {
  title: string
  children: React.ReactNode
  trigger: React.ReactNode
}

export function ReadMoreModal({
  title,
  children,
  trigger
}: ReadMoreModalProps) {
  const [open, setOpen] = useState(false)
  const isDesktop = useIsDesktop()

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
          <div className='prose prose-neutral dark:prose-invert prose-sm'>
            {children}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button type='button' onClick={() => setOpen(true)}>
        {trigger}
      </button>
      <SheetContent
        side='bottom'
        className='max-h-[85vh] overflow-y-auto rounded-t-xl'>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className='prose prose-neutral dark:prose-invert prose-sm mt-4'>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
