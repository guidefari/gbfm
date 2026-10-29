import { Pressable, Text, View } from 'react-native'

import { useThemeColors, withAlpha } from '@/theme/colors'
import { fonts } from '@/theme/fonts'

export function PlayerSheetHeader({ onClose }: { readonly onClose: () => void }) {
  const colors = useThemeColors()

  return (
    <View style={{ height: 56, flexShrink: 0, alignItems: 'flex-end', paddingHorizontal: 16 }}>
      <View
        style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          marginLeft: -18,
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: withAlpha(colors.muted, 0.45),
        }}
      />
      <Pressable
        accessibilityRole='button'
        accessibilityLabel='Close'
        onPress={onClose}
        style={({ pressed }) => ({
          marginTop: 12,
          minHeight: 44,
          justifyContent: 'center',
          paddingHorizontal: 8,
          opacity: pressed ? 0.7 : 1,
        })}>
        <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 14 }}>Close</Text>
      </Pressable>
    </View>
  )
}
