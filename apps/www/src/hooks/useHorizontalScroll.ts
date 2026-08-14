import { useCallback, useEffect, useRef, useState } from 'react'

const VIEWPORT_SELECTOR = '[data-radix-scroll-area-viewport]'

/**
 * Tracks scroll position of a Radix ScrollArea viewport inside the ref'd container.
 * Returns the container ref, whether left/right scroll is possible, and a scroll function.
 */
export function useHorizontalScroll() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = containerRef.current?.querySelector(VIEWPORT_SELECTOR)
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = containerRef.current?.querySelector(VIEWPORT_SELECTOR)
    if (!el) return undefined
    updateScrollState()
    el.addEventListener('scroll', updateScrollState)
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      observer.disconnect()
    }
  }, [updateScrollState])

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = containerRef.current?.querySelector(VIEWPORT_SELECTOR)
    if (!el) return
    const amount = el.clientWidth * 0.75
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    })
  }, [])

  return { containerRef, canScrollLeft, canScrollRight, scroll }
}
