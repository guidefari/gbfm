import { Link } from '@tanstack/react-router'
import { LogIn, Menu, User, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import {
  useAudioPlayerPlaybackState,
  useAudioPlayerVisibilityState
} from '@/store/audioPlayer'
import { navItemsForSurface } from '../NavLinks'
import { NowPlayingMini } from './NowPlayingMini'

type FloatingMenuProps = {
  className?: string
}

export function FloatingMenu({ className }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { audioSrc } = useAudioPlayerPlaybackState()
  const { isFullscreenVisible } = useAudioPlayerVisibilityState()
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)

  const hasActiveAudio = Boolean(audioSrc)

  const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), [])
  const closeMenu = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeMenu()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeMenu])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  type Tile = {
    id: string
    slug: string
    label: string
    icon: React.ReactNode
  }

  const navTiles = navItemsForSurface('floating').reduce<Tile[]>(
    (acc, item) => {
      if (typeof item.slug === 'string') {
        acc.push({
          id: item.id,
          slug: item.slug,
          label: item.name,
          icon: item.icon
        })
      }
      return acc
    },
    []
  )

  const accountTile: Tile = isAuthenticated
    ? {
        id: 'account',
        slug: '/dashboard',
        label: 'Profile',
        icon: <User className='w-6 h-6' />
      }
    : {
        id: 'account',
        slug: '/auth/sign-in',
        label: 'Login',
        icon: <LogIn className='w-6 h-6' />
      }

  const tiles = [...navTiles, accountTile]

  return (
    <div className={cn('z-50', className)}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className='fixed inset-0 z-40 flex flex-col justify-end'>
            <button
              type='button'
              className='absolute inset-0 bg-background/95 backdrop-blur-md'
              onClick={closeMenu}
              aria-label='Close menu'
              tabIndex={-1}
            />
            {hasActiveAudio && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                className='relative px-4 mb-6'>
                <NowPlayingMini onClose={closeMenu} />
              </motion.div>
            )}

            <motion.nav
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.2 }}
              className='relative grid grid-cols-3 gap-3 px-4 mb-24'>
              {tiles.map((item) => (
                <Link key={item.id} to={item.slug} onClick={closeMenu}>
                  <div
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 py-4 rounded-sm',
                      'bg-card/50 border border-border/50',
                      'active:scale-95 active:bg-card transition-transform'
                    )}>
                    {item.icon}
                    <span className='text-xs font-medium'>{item.label}</span>
                  </div>
                </Link>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {!isFullscreenVisible && (
        <motion.button
          onClick={toggleMenu}
          className={cn(
            'relative z-50 flex items-center justify-center rounded-sm shadow-lg',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'active:scale-95 transition-transform',
            'bg-primary text-primary-foreground'
          )}
          style={{ width: 56, height: 56 }}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}>
          <motion.div
            animate={{ scale: isOpen ? 1.05 : 1 }}
            transition={{ duration: 0.2 }}>
            {isOpen ? <X className='h-6 w-6' /> : <Menu className='h-6 w-6' />}
          </motion.div>
        </motion.button>
      )}
    </div>
  )
}
