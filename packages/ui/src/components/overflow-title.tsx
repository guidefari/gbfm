import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/cn'

type OverflowTitleStyle = CSSProperties & {
  '--overflow-distance': string
  '--overflow-duration': string
}

type OverflowTitleProps = {
  text: string
  className?: string
  textClassName?: string
  animationClassName?: string
}

export function OverflowTitle({
  text,
  className,
  textClassName,
  animationClassName
}: OverflowTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [overflowPx, setOverflowPx] = useState(0)

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current
      const content = measureRef.current
      if (!container || !content) return
      const overflow = Math.max(0, content.scrollWidth - container.clientWidth)
      setOverflowPx(overflow > 1 ? overflow : 0)
    }

    measure()

    const raf = requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    if (containerRef.current) observer.observe(containerRef.current)
    if (measureRef.current) observer.observe(measureRef.current)

    window.addEventListener('resize', measure)
    document.fonts?.ready.then(measure).catch(() => {})

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const marqueeStyle = useMemo(() => {
    if (overflowPx <= 0) return undefined
    const durationSeconds = Math.max(9, Math.min(20, 8 + overflowPx / 18))
    const style: OverflowTitleStyle = {
      '--overflow-distance': `${overflowPx}px`,
      '--overflow-duration': `${durationSeconds}s`
    }

    return style
  }, [overflowPx])

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      <span
        ref={measureRef}
        className={cn('pointer-events-none invisible absolute whitespace-nowrap', textClassName)}>
        {text}
      </span>

      {overflowPx > 0 ? (
        <div
          className={cn('overflow-title-marquee whitespace-nowrap', animationClassName)}
          style={marqueeStyle}>
          <span className={textClassName}>{text}</span>
        </div>
      ) : (
        <p className={cn('truncate p-0', textClassName)}>{text}</p>
      )}
    </div>
  )
}
