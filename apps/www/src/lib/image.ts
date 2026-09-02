const cdnHostname = 'cdn.goosebumps.fm'

export type ImageFormat = 'avif' | 'webp' | 'jpeg'

interface ImageOptions {
  readonly width: number
  readonly quality?: number
  readonly format?: ImageFormat
}

export const toImageUrl = (src: string, options: ImageOptions): string => {
  let url: URL

  try {
    url = new URL(src)
  } catch {
    return src
  }

  if (url.hostname !== cdnHostname) return src

  url.searchParams.set('w', String(options.width))
  url.searchParams.set('q', String(options.quality ?? 80))
  url.searchParams.set('f', options.format ?? 'webp')
  return url.toString()
}

export const toImageSrcSet = (
  src: string,
  widths: readonly number[],
  options?: Omit<ImageOptions, 'width'>
): string | undefined => {
  const candidates = widths.map((width) => {
    const url = toImageUrl(src, { ...options, width })
    return url === src ? null : `${url} ${width}w`
  })

  return candidates.some((candidate) => candidate !== null)
    ? candidates.filter((candidate) => candidate !== null).join(', ')
    : undefined
}
