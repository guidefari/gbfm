import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { BaseAudioPlayer } from '@/components/common/BaseAudioPlayer'
import { useUIStore } from '@/store'

export function GlobalCompactPlayer() {
  const { toggleCompactPlayer } = useUIStore()
  const playerRef = useRef<HTMLDivElement>(null)
  const lastFocusedElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    lastFocusedElement.current = document.activeElement as HTMLElement
    const timer = setTimeout(() => {
      const focusableElements = playerRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusableElements && focusableElements.length > 0) {
        ;(focusableElements[0] as HTMLElement).focus()
      }
    }, 100)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && playerRef.current) {
        const focusableElements = Array.from(
          playerRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ) as HTMLElement[]

        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      } else if (e.key === 'Escape') {
        toggleCompactPlayer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
      lastFocusedElement.current?.focus()
    }
  }, [toggleCompactPlayer])

  return (
    <motion.div
      ref={playerRef}
      initial={{ opacity: 0, y: 50, scale: 0.9, x: -20 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, y: 50, scale: 0.9, x: -20 }}
      transition={{ type: 'keyframes', damping: 20, stiffness: 300 }}
      className='fixed bottom-6 left-20 z-50 hidden md:block w-[320px] p-6 overflow-hidden border border-border rounded-xl bg-background/95 backdrop-blur-md shadow-2xl border-solid'>
      <button
        type='button'
        onClick={toggleCompactPlayer}
        className='absolute z-10 p-1 transition-colors rounded-full top-3 right-3 hover:bg-muted'
        aria-label='Close player'>
        <X className='w-4 h-4 text-foreground/50 hover:text-foreground' />
      </button>
      <BaseAudioPlayer
        variant='compact'
        showVolume={false}
        showQueue={false}
        showTrackActions={false}
        showFullscreenToggle={false}
      />
    </motion.div>
  )
}
