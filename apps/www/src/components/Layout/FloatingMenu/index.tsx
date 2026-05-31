import { useHotkey } from '@tanstack/react-hotkeys'
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

const tileClass = cn(
  'flex flex-col items-center justify-center gap-2 py-4 rounded-sm',
  'bg-card/50 border border-border/50 text-foreground',
  'transition-colors hover:bg-foreground/10 hover:border-foreground active:scale-95'
)

export function FloatingMenu({ className }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { audioSrc } = useAudioPlayerPlaybackState()
  const { isFullscreenVisible } = useAudioPlayerVisibilityState()
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
  const isAdmin = session?.user?.role === 'admin'

  const hasActiveAudio = Boolean(audioSrc)

  const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), [])
  const closeMenu = useCallback(() => setIsOpen(false), [])

  useHotkey('Mod+K', () => toggleMenu())

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

  const navItems = navItemsForSurface('overlay').filter(
    (item) =>
      (!item.adminOnly || isAdmin) && (!item.authOnly || isAuthenticated)
  )

  const accountTile = isAuthenticated
    ? {
        slug: '/dashboard',
        label: 'Profile',
        icon: <User className='w-6 h-6' />
      }
    : {
        slug: '/auth/sign-in',
        label: 'Login',
        icon: <LogIn className='w-6 h-6' />
      }

  return (
    <div className={cn('z-50', className)}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className='fixed inset-0 z-40 flex flex-col justify-end overflow-y-auto'>
            <button
              type='button'
              className='fixed inset-0 bg-background/95 backdrop-blur-md'
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
                className='relative px-4 mb-6 mx-auto w-full max-w-2xl'>
                <NowPlayingMini onClose={closeMenu} />
              </motion.div>
            )}

            <motion.nav
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.2 }}
              className='relative grid grid-cols-3 sm:grid-cols-4 gap-3 px-4 mb-24 mx-auto w-full max-w-2xl'>
              {navItems.map((item) => {
                if (item.external) {
                  return (
                    <a
                      key={item.id}
                      href={item.external}
                      target='_blank'
                      rel='noreferrer'
                      onClick={closeMenu}
                      className={tileClass}>
                      {item.icon}
                      <span className='text-xs font-medium'>{item.name}</span>
                    </a>
                  )
                }
                if (item.CustomComponent) {
                  return (
                    <div key={item.id} className={tileClass}>
                      {item.CustomComponent}
                      <span className='text-xs font-medium'>{item.name}</span>
                    </div>
                  )
                }
                return (
                  <Link
                    key={item.id}
                    to={item.slug}
                    onClick={closeMenu}
                    className={tileClass}>
                    {item.icon}
                    <span className='text-xs font-medium'>{item.name}</span>
                  </Link>
                )
              })}
              <Link
                to={accountTile.slug}
                onClick={closeMenu}
                className={tileClass}>
                {accountTile.icon}
                <span className='text-xs font-medium'>{accountTile.label}</span>
              </Link>
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
