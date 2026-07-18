import { brand } from '@gbfm/theme'
import * as Linking from 'expo-linking'
import { Effect, Fiber } from 'effect'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-screens/experimental'
import { getFeaturedMix } from '@/api/audio'
import { FeaturedMixCard } from '@/components/Home/FeaturedMixCard'
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

  useEffect(() => {
    const fiber = Effect.runFork(
      getFeaturedMix.pipe(
        Effect.tap((result) => Effect.sync(() => setMix(result))),
        Effect.ensuring(Effect.sync(() => setIsPending(false)))
      )
    )
    return () => {
      Effect.runFork(Fiber.interrupt(fiber))
    }
  }, [])

  return (
    <SafeAreaView
      edges={{ top: true, left: true, right: true }}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: 20, paddingTop: 8, gap: 16 }}>
        <Text
          style={{
            color: colors.accent,
            fontFamily: fonts.serif,
            fontSize: 40,
            lineHeight: 42
          }}>
          goosebumps.fm
        </Text>

        {isPending && !mix ? null : <FeaturedMixCard mix={mix} />}

        <Pressable
          accessibilityRole='button'
          onPress={() => Linking.openURL('https://goosebumps.fm/shows')}
          style={({ pressed }) => ({
            marginTop: 'auto',
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            borderWidth: 2,
            borderColor: colors.accent,
            opacity: pressed ? 0.7 : 1
          })}>
          <Text
            style={{
              color: colors.accent,
              fontSize: 13,
              fontWeight: '700',
              letterSpacing: 1.5,
              textTransform: 'uppercase'
            }}>
            Browse radio shows
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
