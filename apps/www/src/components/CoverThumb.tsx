import { ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

interface CoverThumbProps {
  src: string | null | undefined
  alt?: string
  className?: string
  iconClassName?: string
}

/**
 * Square cover thumbnail that gracefully falls back to a muted placeholder
 * when the source is missing or fails to load (instead of showing the
 * browser's broken-image glyph and leaking alt text).
 */
export function CoverThumb({ src, alt = '', className = '', iconClassName }: CoverThumbProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}>
        <ImageIcon className={iconClassName ?? 'w-1/3 h-1/3'} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading='lazy'
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  )
}
