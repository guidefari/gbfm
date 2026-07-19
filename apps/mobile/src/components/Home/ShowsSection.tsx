import { brand } from '@gbfm/theme'
import { Effect, Fiber } from 'effect'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { getShows, type Show } from '@/api/shows'
import { SHOW_CARD_HEIGHT, SHOW_CARD_WIDTH, ShowCard } from '@/components/Home/ShowCard'
import { fonts } from '@/theme/fonts'

const colors = {
  accent: brand['pastel-green-1'],
  muted: brand['pastel-green-2'],
  text: brand.defaultText
}

const placeholder = 'hsla(198, 45%, 52%, 0.25)'
const placeholderSoft = 'hsla(198, 45%, 52%, 0.12)'

function ShowCardSkeleton() {
  return (
    <View style={{ width: SHOW_CARD_WIDTH, gap: 8 }}>
      <View
        style={{
          width: SHOW_CARD_WIDTH,
          height: 150,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: colors.muted,
          backgroundColor: placeholderSoft
        }}
      />
      <View style={{ gap: 6, height: 34, justifyContent: 'center' }}>
        <View style={{ height: 10, width: '70%', borderRadius: 2, backgroundColor: placeholder }} />
        <View style={{ height: 8, width: '45%', borderRadius: 2, backgroundColor: placeholder }} />
      </View>
    </View>
  )
}

export function ShowsSection() {
  const [shows, setShows] = useState<ReadonlyArray<Show> | null>(null)
  const [isPending, setIsPending] = useState(true)

  const fetchShows = useCallback(() => {
    setIsPending(true)
    return Effect.runFork(
      getShows.pipe(
        Effect.tap((result) => Effect.sync(() => setShows(result))),
        Effect.tapError((error) => Effect.sync(() => console.error('getShows failed', error))),
        Effect.ensuring(Effect.sync(() => setIsPending(false)))
      )
    )
  }, [])

  useEffect(() => {
    const fiber = fetchShows()
    return () => {
      Effect.runFork(Fiber.interrupt(fiber))
    }
  }, [fetchShows])

  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          color: colors.text,
          fontFamily: fonts.monoSemiBold,
          fontSize: 18,
          lineHeight: 22
        }}>
        radio shows
      </Text>
      {isPending ? (
        <ScrollView
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {['a', 'b', 'c'].map((key) => (
            <ShowCardSkeleton key={key} />
          ))}
        </ScrollView>
      ) : shows && shows.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {shows.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </ScrollView>
      ) : shows ? (
        <View
          style={{
            height: SHOW_CARD_HEIGHT,
            borderWidth: 2,
            borderColor: colors.muted,
            borderRadius: 4,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
          <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 13 }}>
            no shows yet
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole='button'
          onPress={fetchShows}
          style={({ pressed }) => ({
            height: SHOW_CARD_HEIGHT,
            borderWidth: 2,
            borderColor: colors.muted,
            borderRadius: 4,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1
          })}>
          <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 13 }}>
            couldn't load shows, tap to retry
          </Text>
        </Pressable>
      )}
    </View>
  )
}
