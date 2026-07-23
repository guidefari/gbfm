import { brand } from '@gbfm/theme'
import { useRouter } from 'expo-router'
import { Image, Pressable, Text, View } from 'react-native'
import type { Show } from '@/api/shows'
import { fonts } from '@/theme/fonts'

const colors = {
  muted: brand['pastel-green-2'],
  surface: brand.darkerBg,
  text: brand.defaultText
}

// Fixed geometry, mirrored by the skeleton in ShowsSection, so that
// loading -> loaded never shifts layout.
export const SHOW_CARD_WIDTH = 150
export const SHOW_CARD_HEIGHT = 150 + 8 + 36

export function ShowCard({ show }: { show: Show }) {
  const router = useRouter()
  const hostNames = show.hosts.map((host) => host.name).join(', ')

  return (
    <Pressable
      accessibilityRole='button'
      onPress={() =>
        router.push({ pathname: '/show/[slug]', params: { slug: show.slug, title: show.title } })
      }
      style={({ pressed }) => ({ width: SHOW_CARD_WIDTH, gap: 8, opacity: pressed ? 0.8 : 1 })}>
      {show.thumbnailUrl ? (
        <Image
          source={{ uri: show.thumbnailUrl }}
          style={{
            width: SHOW_CARD_WIDTH,
            height: 150,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: colors.muted
          }}
          resizeMode='cover'
        />
      ) : (
        <View
          style={{
            width: SHOW_CARD_WIDTH,
            height: 150,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: colors.muted,
            backgroundColor: colors.surface
          }}
        />
      )}
      <View style={{ gap: 2, height: 36 }}>
        <Text
          style={{
            color: '#FFFFFF',
            fontFamily: fonts.monoSemiBold,
            fontSize: 14,
            lineHeight: 18
          }}
          numberOfLines={1}>
          {show.title}
        </Text>
        <Text
          style={{ color: colors.text, fontFamily: fonts.mono, fontSize: 12, lineHeight: 16 }}
          numberOfLines={1}>
          {hostNames}
        </Text>
      </View>
    </Pressable>
  )
}
