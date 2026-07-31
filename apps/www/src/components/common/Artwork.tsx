import { Artwork as BaseArtwork, type ArtworkProps } from '@gbfm/ui'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'

export function Artwork(props: Omit<ArtworkProps, 'fallbackSrc'>) {
  return <BaseArtwork fallbackSrc={DEFAULT_IMAGE_URL} {...props} />
}
