import { Link } from '@tanstack/react-router'
import {
  Disc3,
  Home,
  LogIn,
  Menu,
  Moon,
  Radio,
  Sun,
  User,
  X
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { cn } from '@/lib/utils'
import { useAudioPlayerState } from '@/store/audioPlayer'
import { useAuthStore } from '@/store/auth'
import { NowPlayingMini } from './NowPlayingMini'

type MenuItemConfig = {
  id: string
  icon: React.ReactNode
  label: string
  action: () => void
}

type FloatingMenuProps = {
  className?: string
}

export function FloatingMenu({ className }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const { audioSrc, isFullscreenVisible } = useAudioPlayerState()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

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

  const handleThemeToggle = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  const navItems: MenuItemConfig[] = [
    {
      id: 'home',
      icon: <Home className='w-6 h-6' />,
      label: 'Home',
      action: closeMenu
    },
    {
      id: 'mixes',
      icon: <Disc3 className='w-6 h-6' />,
      label: 'Mixes',
      action: closeMenu
    },
    {
      id: 'shows',
      icon: <Radio className='w-6 h-6' />,
      label: 'Shows',
      action: closeMenu
    },
    isAuthenticated
      ? {
          id: 'profile',
          icon: <User className='w-6 h-6' />,
          label: 'Profile',
          action: closeMenu
        }
      : {
          id: 'login',
          icon: <LogIn className='w-6 h-6' />,
          label: 'Login',
          action: closeMenu
        }
  ].filter(Boolean)

  const quickActions: MenuItemConfig[] = [
    {
      id: 'theme',
      icon:
        resolvedTheme === 'dark' ? (
          <Sun className='w-5 h-5' />
        ) : (
          <Moon className='w-5 h-5' />
        ),
      label: resolvedTheme === 'dark' ? 'Light' : 'Dark',
      action: handleThemeToggle
    }
  ]

  const getItemRoute = (id: string): string | null => {
    switch (id) {
      case 'home':
        return '/'
      case 'mixes':
        return '/mixes'
      case 'shows':
        return '/shows'
      case 'profile':
        return '/settings/profile'
      case 'login':
        return '/auth/sign-in'
      default:
        return null
    }
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
            className='fixed inset-0 z-40 flex flex-col justify-end bg-background/95 backdrop-blur-md'>
            {hasActiveAudio && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                className='px-4 mb-6'>
                <NowPlayingMini onClose={closeMenu} />
              </motion.div>
            )}

            <motion.nav
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.2 }}
              className='grid grid-cols-4 gap-3 px-4 mb-4'>
              {navItems.map((item) => {
                const route = getItemRoute(item.id)
                const content = (
                  <div
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 py-4 rounded-sm',
                      'bg-card/50 border border-border/50',
                      'active:scale-95 active:bg-card transition-transform'
                    )}>
                    {item.icon}
                    <span className='text-xs font-medium'>{item.label}</span>
                  </div>
                )

                if (route) {
                  return (
                    <Link key={item.id} to={route} onClick={item.action}>
                      {content}
                    </Link>
                  )
                }
                return (
                  <button
                    type='button'
                    key={item.id}
                    onClick={item.action}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 py-4 rounded-sm',
                      'bg-card/50 border border-border/50',
                      'active:scale-95 active:bg-card transition-transform'
                    )}>
                    {item.icon}
                    <span className='text-xs font-medium'>{item.label}</span>
                  </button>
                )
              })}
            </motion.nav>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className='flex items-center justify-between gap-3 px-4 pb-4'>
              <div className='flex items-center gap-3'>
                {quickActions.map((action) => (
                  <button
                    type='button'
                    key={action.id}
                    onClick={action.action}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 rounded-sm',
                      'bg-card border border-border',
                      'active:scale-95 active:bg-accent transition-transform'
                    )}>
                    {action.icon}
                    <span className='text-sm font-medium'>{action.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
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
            isOpen
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-primary text-primary-foreground'
          )}
          style={{ width: 56, height: 56 }}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}>
          <motion.div
            animate={{ rotate: isOpen ? 135 : 0 }}
            transition={{ duration: 0.2 }}>
            {isOpen ? <X className='w-6 h-6' /> : <Menu className='w-6 h-6' />}
          </motion.div>
        </motion.button>
      )}
    </div>
  )
}
