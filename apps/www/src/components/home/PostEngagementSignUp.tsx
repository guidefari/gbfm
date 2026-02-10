import { Link } from '@tanstack/react-router'
import { Heart, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAudioPlayerState } from '@/store/audioPlayer'
import { useAuthStore } from '@/store/auth'
import { useOnboardingStore } from '@/store/onboarding'

export function PostEngagementSignUp() {
  const [isVisible, setIsVisible] = useState(false)
  const { isAuthenticated } = useAuthStore()
  const { shouldShowSignUpPrompt, dismissSignUpPrompt, markSignUpPromptSeen } =
    useOnboardingStore()
  const { audioSrc } = useAudioPlayerState()

  useEffect(() => {
    if (!audioSrc || isAuthenticated) {
      setIsVisible(false)
      return
    }

    if (!shouldShowSignUpPrompt()) {
      return
    }

    const timer = setTimeout(() => {
      setIsVisible(true)
      markSignUpPromptSeen()
    }, 3000)

    return () => clearTimeout(timer)
  }, [audioSrc, isAuthenticated, shouldShowSignUpPrompt, markSignUpPromptSeen])

  const handleDismiss = () => {
    setIsVisible(false)
    dismissSignUpPrompt()
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className='fixed bottom-24 left-4 right-4 z-40 mx-auto max-w-sm'>
          <div className='bg-background/95 backdrop-blur-sm border border-border p-4 shadow-xl'>
            <button
              type='button'
              onClick={handleDismiss}
              className='absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors'>
              <X className='w-4 h-4' />
              <span className='sr-only'>Dismiss</span>
            </button>

            <div className='flex items-start gap-3'>
              <Heart className='w-5 h-5 text-highlight shrink-0 mt-0.5' />
              <div className='space-y-3'>
                <div>
                  <p className='text-sm font-medium'>Like this?</p>
                  <p className='text-xs text-muted-foreground'>
                    Sign up to save favorites and get notified of new additions
                    to the archive.
                  </p>
                </div>
                <div className='flex gap-2'>
                  <Button size='sm' asChild>
                    <Link to='/auth/sign-up' onClick={handleDismiss}>
                      Sign Up Free
                    </Link>
                  </Button>
                  <Button variant='ghost' size='sm' onClick={handleDismiss}>
                    Maybe Later
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
