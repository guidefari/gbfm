import { useEffect } from 'react'
import { AccessibilityInfo, Text, View } from 'react-native'

import type { FavoriteNotice } from '@/favorites/favoriteState'
import { useThemeColors, withAlpha } from '@/theme/colors'
import { fonts } from '@/theme/fonts'

export function FavoriteToast({ notice }: { readonly notice: FavoriteNotice | null }) {
  const colors = useThemeColors()

  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(notice.message)
  }, [notice])

  if (!notice) return null

  return (
    <View
      pointerEvents='none'
      accessibilityLiveRegion='polite'
      style={{
        position: 'absolute',
        bottom: '100%',
        marginBottom: 12,
        left: 0,
        right: 0,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: withAlpha(colors.error, 0.5),
        borderLeftWidth: 3,
        backgroundColor: colors.surface,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}>
      <Text style={{ color: colors.strong, fontFamily: fonts.mono, fontSize: 12, lineHeight: 18 }}>
        {notice.message}
      </Text>
    </View>
  )
}
