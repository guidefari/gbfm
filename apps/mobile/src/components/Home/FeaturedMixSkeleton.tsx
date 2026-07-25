import { View } from 'react-native'
import { useThemeColors } from '@/theme/colors'
import { FEATURED_CARD_BUTTON_HEIGHT, FEATURED_CARD_INFO_HEIGHT } from './FeaturedMixCard'

const placeholder = 'hsla(198, 45%, 52%, 0.25)'
const placeholderSoft = 'hsla(198, 45%, 52%, 0.12)'

export function FeaturedMixSkeleton() {
  const colors = useThemeColors()

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: colors.accent,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: colors.surface
      }}>
      <View style={{ aspectRatio: 1, backgroundColor: placeholderSoft }} />
      <View
        style={{
          height: FEATURED_CARD_INFO_HEIGHT,
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 16
        }}>
        <View style={{ height: 14, width: '55%', borderRadius: 2, backgroundColor: placeholder }} />
        <View style={{ height: 10, width: '35%', borderRadius: 2, backgroundColor: placeholder }} />
      </View>
      <View style={{ height: FEATURED_CARD_BUTTON_HEIGHT, backgroundColor: placeholder }} />
    </View>
  )
}
