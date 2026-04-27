import { useNavigate } from '@tanstack/react-router'
import { Bell, Disc3, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/auth'
import { useOnboardingStore } from '@/store/onboarding'

export function WelcomeModal() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()
  const { hasSeenWelcome, markWelcomeSeen } = useOnboardingStore()

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
    navigate({ to: '/mixes' })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className='max-w-md p-5 sm:p-6'>
        <DialogHeader className='space-y-1 text-left'>
          <DialogTitle className='text-lg sm:text-xl'>
            Welcome{user?.name && `, ${user.name.split(' ')[0]}`}
          </DialogTitle>
          <DialogDescription className='text-sm'>
            You're now part of the archive. Here's what you can do:
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3 py-2'>
          <div className='flex items-start gap-3'>
            <div className='p-2 bg-highlight/10 rounded-sm'>
              <Heart className='w-4 h-4 text-highlight' />
            </div>
            <div>
              <p className='text-sm font-medium'>Favorite mixes</p>
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
              <p className='text-sm font-medium'>Get notified</p>
              <p className='text-xs text-muted-foreground'>
                Know when new mixes drop
              </p>
            </div>
          </div>

          <div className='flex items-start gap-3'>
            <div className='p-2 bg-highlight/10 rounded-sm'>
              <Disc3 className='w-4 h-4 text-highlight' />
            </div>
            <div>
              <p className='text-sm font-medium'>Contribute</p>
              <p className='text-xs text-muted-foreground'>
                Upload your own mixes to the archive
              </p>
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
