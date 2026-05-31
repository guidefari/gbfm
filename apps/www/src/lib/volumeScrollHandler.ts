/**
 * Vanilla JS utility for handling volume scroll events
 * No React dependencies - just pure DOM event handling
 */

type VolumeScrollConfig = {
  onVolumeChange: (newVolume: number) => void
  getCurrentVolume: () => number
  getIsMuted: () => boolean
  volumeStep?: number
}

/**
 * Simple function-based approach (alternative to class)
 * returns a function to detach the scroll handler
 */
export const attachVolumeScroll = (element: HTMLElement, config: VolumeScrollConfig) => {
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const currentVolume = config.getCurrentVolume()
    const isMuted = config.getIsMuted()

    // Calculate volume change with weighted scrolling
    const delta = -e.deltaY // Negative because wheel up should increase volume
    const baseStep = config.volumeStep || 5

    // Use deltaY magnitude for more natural scrolling
    // Clamp deltaY to reasonable range and apply exponential scaling
    const clampedDelta = Math.max(-150, Math.min(150, delta))
    const normalizedDelta = clampedDelta / 100 // Normalize to -1.5 to 1.5 range

    // Exponential scaling for more natural feel
    const scaleFactor = Math.abs(normalizedDelta) ** 1.5 // Power curve for sensitivity
    const direction = Math.sign(normalizedDelta)
    const volumeChange = direction * Math.max(1, baseStep * scaleFactor)

    const newVolume = Math.max(0, Math.min(100, currentVolume + volumeChange))

    if (isMuted && volumeChange > 0) {
      config.onVolumeChange(Math.max(baseStep, newVolume))
    } else {
      config.onVolumeChange(newVolume)
    }
  }

  element.addEventListener('wheel', handleWheel, { passive: false })

  // Return cleanup function
  return () => element.removeEventListener('wheel', handleWheel)
}
