import { useCallback, useEffect, useRef, useState } from 'react'
import { runAppEffect } from '@/runtime'
import { renderTweetImageEffect } from './export-tweet-image'

export type PrerenderInput = {
  readonly enabled: boolean
  readonly imageUrl: string | null
  readonly slug: string
  readonly format: string
}

export type PrerenderedImage = {
  readonly pending: boolean
  /** The PNG for the selected format, or null while the preload is pending. */
  readonly consume: () => Blob | null
}

/** Loads ahead of the tap so `navigator.share` runs inside the transient
 * activation window iOS Safari and Chrome Android require. */
export function usePrerenderedTweetImage({
  enabled,
  imageUrl,
  slug,
  format
}: PrerenderInput): PrerenderedImage {
  const [pending, setPending] = useState(false)
  const blobRef = useRef<Blob | null>(null)

  useEffect(() => {
    blobRef.current = null

    if (!enabled || !imageUrl) {
      setPending(false)
      return () => {}
    }

    let active = true
    setPending(true)

    void runAppEffect(renderTweetImageEffect({ imageUrl, slug, format }))
      .then((rendered) => {
        if (active) blobRef.current = rendered
      })
      .catch(() => {
        if (active) blobRef.current = null
      })
      .finally(() => {
        if (active) setPending(false)
      })

    return () => {
      active = false
    }
  }, [enabled, imageUrl, slug, format])

  const consume = useCallback(() => blobRef.current, [])

  return { pending, consume }
}
