import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import { AsyncResult } from 'effect/unstable/reactivity'
import { useRouter } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { FeaturedMixCard } from '@/components/Home/FeaturedMixCard'
import { FeaturedMixSkeleton } from '@/components/Home/FeaturedMixSkeleton'
import { ShowsSection } from '@/components/Home/ShowsSection'
import { Screen } from '@/components/Screen'
import { featuredMixAtom } from '@/store/atoms/featured-mix'
import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'

export default function Home() {
  const result = useAtomValue(featuredMixAtom)
  const refresh = useAtomRefresh(featuredMixAtom)
  const { loadAndPlay, togglePlayback, track, isPlaying, isBuffering, isLoaded } = useNowPlaying()
  const router = useRouter()
  const colors = useThemeColors()

  const mix = AsyncResult.isSuccess(result) ? result.value : null
  const isThisMix = mix !== null && track?.id === mix.id
  const isThisMixPlaying = isThisMix && isPlaying
  const isThisMixLoading = isThisMix && (isBuffering || !isLoaded)

  const handlePlay = () => {
    if (!mix) return
    if (track?.id === mix.id) {
      togglePlayback()
      return
    }
    loadAndPlay(mix)
    router.push('/now-playing')
  }

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16 }}>
        <Text
          style={{
            color: colors.accent,
            fontFamily: fonts.monoSemiBold,
            fontWeight: 'bold',
            fontSize: 22,
            lineHeight: 26
          }}>
          goosebumps.fm
        </Text>

        {AsyncResult.isInitial(result) || AsyncResult.isWaiting(result) ? (
          <FeaturedMixSkeleton />
        ) : (
          <FeaturedMixCard
            mix={mix}
            isPlaying={isThisMixPlaying}
            isCurrent={isThisMix}
            isLoading={isThisMixLoading}
            onPressPlay={handlePlay}
            onRetry={refresh}
          />
        )}

        <ShowsSection />
      </ScrollView>
    </Screen>
  )
}
