import { useCallback, useEffect, useRef, useState } from 'react'
import { runAppEffect } from '@/runtime'
import { renderTweetImageEffect } from './export-tweet-image'

export type PrerenderInput = {
  readonly enabled: boolean
  readonly renderKey: string
  readonly nodeRef: { readonly current: HTMLElement | null }
  readonly frameWidth: number
  readonly slug: string
  readonly format: string
}

export type PrerenderedImage = {
  readonly pending: boolean
  /** The PNG for the currently selected format, or null when the pre-render
   *  has not landed yet and the caller must rasterize on demand. */
  readonly consume: () => Blob | null
}

/** Rasterizes ahead of the tap so `navigator.share` runs inside the transient
 *  activation window iOS Safari and Chrome Android require. */
export function usePrerenderedTweetImage({
  enabled,
  renderKey,
  nodeRef,
  frameWidth,
  slug,
  format
}: PrerenderInput): PrerenderedImage {
  const [pending, setPending] = useState(false)
  const blobRef = useRef<Blob | null>(null)

  useEffect(() => {
    blobRef.current = null

    const node = enabled ? nodeRef.current : null
    if (!node) {
      setPending(false)
      return () => {}
    }

    let active = true
    setPending(true)

    void runAppEffect(renderTweetImageEffect({ node, frameWidth, slug, format }))
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
  }, [enabled, renderKey, nodeRef, frameWidth, slug, format])

  const consume = useCallback(() => blobRef.current, [])

  return { pending, consume }
}
