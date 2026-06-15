import { useHotkey } from '@tanstack/react-hotkeys'
import { Link, useLocation } from '@tanstack/react-router'
import { LayoutDashboard, LogIn, Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { canSeeNavItem } from '@/lib/nav-access'
import { cn } from '@/lib/utils'
import { useAudioPlayerPlaybackState, useAudioPlayerVisibilityState } from '@/store/audioPlayer'
import { type NavItem, navItemsForSurface } from '../NavLinks'
import { NowPlayingMini } from './NowPlayingMini'
import { useRovingGrid } from './useRovingGrid'

type FloatingMenuProps = {
  className?: string
}

type RovingProps = {
  tabIndex: number
  onFocus: () => void
  onKeyDown: (event: React.KeyboardEvent) => void
}

type TileBinding = {
  ref: (node: HTMLElement | null) => void
  props: RovingProps
}

const tileClass = cn(
  'flex flex-col items-center justify-center gap-2 py-4 rounded-sm',
  'bg-card/50 border border-border/50 text-foreground',
  'transition-colors hover:bg-foreground/10 hover:border-foreground active:scale-95'
)

const tileLabelClass = 'w-full px-1 text-center text-xs font-medium leading-tight'

const sectionHeaderClass = 'text-xs font-bold tracking-widest uppercase text-muted-foreground'

const sectionGridClass = 'grid grid-cols-3 sm:grid-cols-4 gap-3'

function NavTile({
  item,
  binding,
  onClose
}: {
  item: NavItem
  binding: TileBinding
  onClose: () => void
}) {
  if (item.external) {
    return (
      <a
        ref={binding.ref}
        href={item.external}
        target='_blank'
        rel='noreferrer'
        onClick={onClose}
        className={tileClass}
        {...binding.props}>
        {item.icon}
        <span className={tileLabelClass}>{item.name}</span>
      </a>
    )
  }
  if (item.CustomComponent) {
    return (
      <div ref={binding.ref} className={tileClass} {...binding.props}>
        {item.CustomComponent}
        <span className={tileLabelClass}>{item.name}</span>
      </div>
    )
  }
  return (
    <Link
      ref={binding.ref}
      to={item.slug}
      onClick={onClose}
      className={tileClass}
      {...binding.props}>
      {item.icon}
      <span className={tileLabelClass}>{item.name}</span>
    </Link>
  )
}

export function FloatingMenu({ className }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { audioSrc } = useAudioPlayerPlaybackState()
  const { isFullscreenVisible } = useAudioPlayerVisibilityState()
  const { data: session } = useSession()
  const location = useLocation()
  const isAuthenticated = Boolean(session?.user)
  const role = session?.user?.role

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

  const overlayItems = navItemsForSurface('overlay')

  const browseItems = overlayItems.filter(
    (item) => (item.tier === 'primary' || item.tier === 'secondary') && !item.adminOnly
  )

  const createItems = overlayItems.filter(
    (item) => item.tier === 'create' && canSeeNavItem(item, { isAuthenticated, role })
  )

  const adminItems = overlayItems.filter(
    (item) => item.adminOnly && canSeeNavItem(item, { isAuthenticated, role })
  )

  const utilityItems = overlayItems.filter((item) => item.tier === 'utility')

  const tileCount =
    browseItems.length + createItems.length + 1 + adminItems.length + utilityItems.length
  const { gridRef, registerTile, getTileProps } = useRovingGrid(tileCount, isOpen)

  const bind = (index: number): TileBinding => ({
    ref: registerTile(index),
    props: getTileProps(index)
  })

  let cursor = 0
  const browseStart = cursor
  cursor += browseItems.length
  const createStart = cursor
  cursor += createItems.length
  const accountTileIndex = cursor
  cursor += 1
  const adminStart = cursor
  cursor += adminItems.length
  const utilityStart = cursor

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
              ref={gridRef}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.2 }}
              aria-label='Site navigation'
              className='relative flex flex-col gap-6 px-4 mb-24 mx-auto w-full max-w-2xl'>
              <section className='flex flex-col gap-3'>
                <span className={sectionHeaderClass}>Browse</span>
                <div className={sectionGridClass}>
                  {browseItems.map((item, i) => (
                    <NavTile
                      key={item.id}
                      item={item}
                      binding={bind(browseStart + i)}
                      onClose={closeMenu}
                    />
                  ))}
                </div>
              </section>

              {createItems.length > 0 && (
                <section className='flex flex-col gap-3'>
                  <span className={sectionHeaderClass}>Create</span>
                  <div className={sectionGridClass}>
                    {createItems.map((item, i) => (
                      <NavTile
                        key={item.id}
                        item={item}
                        binding={bind(createStart + i)}
                        onClose={closeMenu}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section className='flex flex-col gap-3'>
                <span className={sectionHeaderClass}>Account</span>
                <div className={sectionGridClass}>
                  {isAuthenticated ? (
                    <Link
                      ref={registerTile(accountTileIndex)}
                      to='/dashboard'
                      onClick={closeMenu}
                      className={tileClass}
                      {...getTileProps(accountTileIndex)}>
                      <LayoutDashboard className='w-6 h-6' />
                      <span className={tileLabelClass}>Dashboard</span>
                    </Link>
                  ) : (
                    <Link
                      ref={registerTile(accountTileIndex)}
                      to='/auth/sign-in'
                      search={{ redirect: location.pathname }}
                      onClick={closeMenu}
                      className={tileClass}
                      {...getTileProps(accountTileIndex)}>
                      <LogIn className='w-6 h-6' />
                      <span className={tileLabelClass}>Login</span>
                    </Link>
                  )}
                  {adminItems.map((item, i) => (
                    <NavTile
                      key={item.id}
                      item={item}
                      binding={bind(adminStart + i)}
                      onClose={closeMenu}
                    />
                  ))}
                  {utilityItems.map((item, i) => (
                    <NavTile
                      key={item.id}
                      item={item}
                      binding={bind(utilityStart + i)}
                      onClose={closeMenu}
                    />
                  ))}
                </div>
              </section>
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
          <motion.div animate={{ scale: isOpen ? 1.05 : 1 }} transition={{ duration: 0.2 }}>
            {isOpen ? <X className='h-6 w-6' /> : <Menu className='h-6 w-6' />}
          </motion.div>
        </motion.button>
      )}
    </div>
  )
}
