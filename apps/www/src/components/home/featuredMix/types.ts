import type { useFeaturedMix } from '@/lib/useFeaturedMix'

export type FeaturedMix = NonNullable<ReturnType<typeof useFeaturedMix>['data']>

export type FeaturedMixVariantProps = {
  featuredMix: FeaturedMix | undefined
  isPending: boolean
  showPause: boolean
  isThisMixLoaded: boolean
  error: string | null
  onPlay: () => void
  onBrowse: () => void
}
