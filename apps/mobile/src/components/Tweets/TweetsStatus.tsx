import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'

type Props =
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string; readonly onRetry: () => void }

export function TweetsStatus(props: Props) {
  const colors = useThemeColors()

  return (
    <View
      style={{
        flex: 1,
        minHeight: 240,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
      {props.kind === 'loading' ? (
        <ActivityIndicator size='large' color={colors.accent} />
      ) : (
        <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 14 }}>
          {props.message}
        </Text>
      )}
      {props.kind === 'error' ? (
        <Pressable
          accessibilityRole='button'
          onPress={props.onRetry}
          style={({ pressed }) => ({
            borderWidth: 2,
            borderColor: colors.accent,
            borderRadius: 4,
            paddingHorizontal: 20,
            paddingVertical: 10,
            opacity: pressed ? 0.7 : 1,
          })}>
          <Text style={{ color: colors.accent, fontFamily: fonts.monoSemiBold, fontSize: 14 }}>
            retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
