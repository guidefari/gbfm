export type ImageFormat = 'avif' | 'webp' | 'jpeg'

export interface ImageOptions {
  readonly width: number
  readonly quality: number
  readonly format: ImageFormat
}

const isImageFormat = (value: string): value is ImageFormat =>
  value === 'avif' || value === 'webp' || value === 'jpeg'

export const parseImageOptions = (url: URL): ImageOptions | null => {
  const width = Number(url.searchParams.get('w'))
  const quality = Number(url.searchParams.get('q') ?? '80')
  const format = url.searchParams.get('f') ?? 'webp'

  if (!Number.isInteger(width) || width < 1 || width > 2048) return null
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) return null
  if (!isImageFormat(format)) return null

  return { width, quality, format }
}

const contentTypes = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpeg: 'image/jpeg'
} satisfies Record<ImageFormat, 'image/avif' | 'image/webp' | 'image/jpeg'>

export const toContentType = (format: ImageFormat) => contentTypes[format]
