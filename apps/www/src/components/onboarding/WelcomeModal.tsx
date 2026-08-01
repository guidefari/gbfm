import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@gbfm/ui'
import { useNavigate } from '@tanstack/react-router'
import { Bell, Disc3, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { useHasSeenWelcome, useOnboardingActions } from '@/store/onboarding'

export function WelcomeModal() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
  const user = session?.user
  const hasSeenWelcome = useHasSeenWelcome()
  const { markWelcomeSeen } = useOnboardingActions()

  useEffect(() => {
    if (isAuthenticated && !hasSeenWelcome) {
      const timer = setTimeout(() => {
        setOpen(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated, hasSeenWelcome])

  const handleClose = () => {
    setOpen(false)
    markWelcomeSeen()
  }

  const handleExplore = () => {
    handleClose()
    navigate({ to: '/shows' })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className='max-w-md p-5 sm:p-6'>
        <DialogHeader className='space-y-1 text-left'>
          <DialogTitle className='text-lg sm:text-xl'>
            Welcome{user?.name && `, ${user.name.split(' ')[0]}`}
          </DialogTitle>
          <DialogDescription className='text-base'>
            You're now part of the archive. Here's what you can do:
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3 py-2'>
          <div className='flex items-start gap-3'>
            <div className='p-2 bg-highlight/10 rounded-sm'>
              <Heart className='w-4 h-4 text-highlight' />
            </div>
            <div>
              <p className='text-base font-medium'>Favorite mixes</p>
              <p className='text-xs text-muted-foreground'>
                Save the ones that give you goosebumps
              </p>
            </div>
          </div>

          <div className='flex items-start gap-3'>
            <div className='p-2 bg-highlight/10 rounded-sm'>
              <Bell className='w-4 h-4 text-highlight' />
            </div>
            <div>
              <p className='text-base font-medium'>Get notified</p>
              <p className='text-xs text-muted-foreground'>Know when new mixes drop</p>
            </div>
          </div>

          <div className='flex items-start gap-3'>
            <div className='p-2 bg-highlight/10 rounded-sm'>
              <Disc3 className='w-4 h-4 text-highlight' />
            </div>
            <div>
              <p className='text-base font-medium'>Contribute</p>
              <p className='text-xs text-muted-foreground'>Upload your own mixes to the archive</p>
            </div>
          </div>
        </div>

        <Button onClick={handleExplore} className='w-full'>
          Start exploring
        </Button>
      </DialogContent>
    </Dialog>
  )
}
