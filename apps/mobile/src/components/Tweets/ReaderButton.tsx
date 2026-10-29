import { Pressable, Text } from 'react-native'

import { Glyph } from '@/icons/Glyph'
import type { GlyphName } from '@/icons/glyphs'
import { useThemeColors, withAlpha } from '@/theme/colors'
import { fonts } from '@/theme/fonts'

export function ReaderButton({
  label,
  onPress,
  disabled = false,
  primary = false,
  accessibilityLabel,
  glyph,
}: {
  readonly label: string
  readonly onPress: () => void
  readonly disabled?: boolean
  readonly primary?: boolean
  readonly accessibilityLabel?: string
  readonly glyph?: GlyphName
}) {
  const colors = useThemeColors()

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
        borderWidth: 1,
        borderColor: withAlpha(primary ? colors.accent : colors.muted, 0.4),
        backgroundColor: primary ? withAlpha(colors.accent, 0.1) : colors.surface,
        opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
      })}>
      {glyph ? (
        <Glyph name={glyph} size={14} color={primary ? colors.accent : colors.strong} />
      ) : null}
      <Text
        style={{
          color: primary ? colors.accent : colors.strong,
          fontFamily: fonts.mono,
          fontSize: 12,
        }}>
        {label}
      </Text>
    </Pressable>
  )
}
