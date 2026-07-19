import { brand } from '@gbfm/theme'
import { Effect } from 'effect'
import { useRouter } from 'expo-router'
import { ScrollView, Text } from 'react-native'
import { SafeAreaView } from 'react-native-screens/experimental'
import { getFeaturedMix } from '@/api/audio'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { FeaturedMixCard } from '@/components/Home/FeaturedMixCard'
import { FeaturedMixSkeleton } from '@/components/Home/FeaturedMixSkeleton'
import { ShowsSection } from '@/components/Home/ShowsSection'
import { useAsyncAtom } from '@/store/result'
import { fonts } from '@/theme/fonts'

const colors = {
  background: brand.bg,
  accent: brand['pastel-green-1'],
  muted: brand['pastel-green-2'],
  text: brand.defaultText,
  surface: brand.darkerBg
}

export default function Home() {
  const {
    status,
    value: mix,
    refresh
  } = useAsyncAtom(
    () =>
      getFeaturedMix.pipe(
        Effect.tapError((error) => Effect.sync(() => console.error('getFeaturedMix failed', error)))
      ),
    []
  )
  const { loadAndPlay, togglePlayback, track, isPlaying, isBuffering, isLoaded } = useNowPlaying()
  const router = useRouter()

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
    <SafeAreaView
      edges={{ top: true, left: true, right: true }}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 16 }}>
        <Text
          style={{
            color: colors.accent,
            fontFamily: fonts.monoSemiBold,
            fontWeight: 'bold',
            fontSize: 28,
            lineHeight: 32
          }}>
          goosebumps.fm
        </Text>

        {status === 'pending' ? (
          <FeaturedMixSkeleton />
        ) : (
          <FeaturedMixCard
            mix={mix}
            isPlaying={isThisMixPlaying}
            isLoading={isThisMixLoading}
            onPressPlay={handlePlay}
            onRetry={refresh}
          />
        )}

        <ShowsSection />
      </ScrollView>
    </SafeAreaView>
  )
}
