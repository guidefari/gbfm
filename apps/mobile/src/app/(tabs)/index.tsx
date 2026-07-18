import { brand } from '@gbfm/theme'
import { Effect, Fiber } from 'effect'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-screens/experimental'
import { getFeaturedMix } from '@/api/audio'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { FeaturedMixCard } from '@/components/Home/FeaturedMixCard'
import { FeaturedMixSkeleton } from '@/components/Home/FeaturedMixSkeleton'
import { fonts } from '@/theme/fonts'
import type { AudioResponse } from '@gbfm/api/audio'

const colors = {
  background: brand.bg,
  accent: brand['pastel-green-1'],
  muted: brand['pastel-green-2'],
  text: brand.defaultText,
  surface: brand.darkerBg
}

export default function Home() {
  const [mix, setMix] = useState<typeof AudioResponse.Type | null>(null)
  const [isPending, setIsPending] = useState(true)
  const { loadAndPlay, togglePlayback, track, isPlaying, isBuffering, isLoaded } = useNowPlaying()
  const router = useRouter()

  const fetchMix = useCallback(() => {
    setIsPending(true)
    return Effect.runFork(
      getFeaturedMix.pipe(
        Effect.tap((result) => Effect.sync(() => setMix(result))),
        Effect.tapError((error) =>
          Effect.sync(() => console.error('getFeaturedMix failed', error))
        ),
        Effect.ensuring(Effect.sync(() => setIsPending(false)))
      )
    )
  }, [])

  useEffect(() => {
    const fiber = fetchMix()
    return () => {
      Effect.runFork(Fiber.interrupt(fiber))
    }
  }, [fetchMix])

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
      edges={{ top: true, left: true, right: true, bottom: true }}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: 20, paddingTop: 8, gap: 16 }}>
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

        {isPending ? (
          <FeaturedMixSkeleton />
        ) : (
          <FeaturedMixCard
            mix={mix}
            isPlaying={isThisMixPlaying}
            isLoading={isThisMixLoading}
            onPressPlay={handlePlay}
            onRetry={fetchMix}
          />
        )}
      </View>
    </SafeAreaView>
  )
}
