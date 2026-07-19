import { brand } from '@gbfm/theme'
import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import { AsyncResult } from 'effect/unstable/reactivity'
import { Pressable, ScrollView, Text, View } from 'react-native'
import type { Show } from '@/api/shows'
import { SHOW_CARD_HEIGHT, SHOW_CARD_WIDTH, ShowCard } from '@/components/Home/ShowCard'
import { showsAtom } from '@/store/atoms/shows'
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
  const result = useAtomValue(showsAtom)
  const refresh = useAtomRefresh(showsAtom)

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
      {AsyncResult.isInitial(result) || AsyncResult.isWaiting(result) ? (
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
      ) : AsyncResult.isSuccess(result) && result.value.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {result.value.map((show: Show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </ScrollView>
      ) : AsyncResult.isSuccess(result) ? (
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
          onPress={refresh}
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
