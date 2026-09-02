import { Artwork as BaseArtwork, type ArtworkProps } from '@gbfm/ui'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { toImageSrcSet, toImageUrl } from '@/lib/image'

export function Artwork({
  src,
  width,
  sizes,
  onError,
  ...props
}: Omit<ArtworkProps, 'fallbackSrc'>) {
  const parsedWidth = Number(width)
  const requestedWidth = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : 640
  const targetWidth = Math.min(Math.max(requestedWidth, 80), 2048)
  const widths = [
    ...new Set([
      Math.max(Math.round(targetWidth / 2), 80),
      targetWidth,
      Math.min(targetWidth * 2, 2048)
    ])
  ]
  const resolvedSrc = src || DEFAULT_IMAGE_URL
  const srcSet = toImageSrcSet(resolvedSrc, widths)

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (event.currentTarget.src === DEFAULT_IMAGE_URL) return
    event.currentTarget.srcset = ''
    event.currentTarget.src = DEFAULT_IMAGE_URL
    onError?.(event)
  }

  return (
    <BaseArtwork
      fallbackSrc={DEFAULT_IMAGE_URL}
      src={toImageUrl(resolvedSrc, { width: targetWidth })}
      width={width}
      sizes={sizes ?? (width === undefined ? '100vw' : `${targetWidth}px`)}
      srcSet={srcSet}
      onError={handleError}
      {...props}
    />
  )
}
