import { inertHtml as h } from 'foldkit/html'

const fallback = 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'

/** Only the GBFM image CDN accepts transformation parameters; original/external URLs stay valid. */
export const artworkUrl = (src: string, width: number): string => {
  let url: URL

  try {
    url = new URL(src)
  } catch {
    return src
  }

  if (url.hostname !== 'cdn.goosebumps.fm') return src
  url.searchParams.set('w', String(width))
  url.searchParams.set('q', '80')
  url.searchParams.set('f', 'webp')

  return url.toString()
}

/** Responsive square artwork with an explicit rendered size and LCP priority only when requested. */
export const artwork = (
  src: string | null | undefined,
  alt: string,
  sizes: string,
  eager = false,
) => {
  const original = src || fallback
  const responsive = artworkUrl(original, 640) !== original

  return h.img([
    h.Src(artworkUrl(original, 640)),
    h.Alt(alt),
    h.Class('artwork'),
    h.Width('640'),
    h.Height('640'),
    h.Sizes(sizes),
    ...(responsive
      ? [
          h.Srcset(
            [160, 320, 640, 960, 1280]
              .map((width) => `${artworkUrl(original, width)} ${width}w`)
              .join(', '),
          ),
        ]
      : []),
    h.Loading(eager ? 'eager' : 'lazy'),
    h.Decoding('async'),
    h.Fetchpriority(eager ? 'high' : 'auto'),
  ])
}

/** Capturing error events also covers image failures before hydration and avoids fallback loops. */
export const startArtworkFallback = () => {
  const recover = (image: HTMLImageElement) => {
    if (!image.classList.contains('artwork') || image.src === fallback) return
    image.removeAttribute('srcset')
    image.src = fallback
  }

  const onError = (event: Event) => {
    if (event.target instanceof HTMLImageElement) recover(event.target)
  }

  document.addEventListener('error', onError, true)
  document.querySelectorAll('img.artwork').forEach((image) => {
    if (image instanceof HTMLImageElement && image.complete && image.naturalWidth === 0)
      recover(image)
  })

  return () => document.removeEventListener('error', onError, true)
}
