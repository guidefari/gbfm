import { brandDark, brandLight } from '@gbfm/theme/tokens'
import { Pressable, Text, useColorScheme, View } from 'react-native'
import { SafeAreaView } from 'react-native-screens/experimental'
import {
  type ColorSchemePreference,
  useColorSchemePreference,
  useSetColorSchemePreference
} from '@/store/preferences'

const choices: ReadonlyArray<{
  readonly value: ColorSchemePreference
  readonly label: string
  readonly description: string
}> = [
  { value: 'system', label: 'System', description: 'Follow your device appearance.' },
  { value: 'light', label: 'Light', description: 'Use the light theme everywhere.' },
  { value: 'dark', label: 'Dark', description: 'Use the dark theme everywhere.' }
]

export default function Preferences() {
  const preference = useColorSchemePreference()
  const setPreference = useSetColorSchemePreference()
  const systemColorScheme = useColorScheme()
  const isDark = (preference === 'system' ? systemColorScheme : preference) !== 'light'
  const colors = isDark ? brandDark : brandLight

  return (
    <SafeAreaView
      edges={{ top: true, left: true, right: true }}
      style={{ flex: 1, padding: 24, gap: 24, backgroundColor: colors.bg }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors['pastel-green-1'], fontSize: 32, fontWeight: '700' }}>
          Preferences
        </Text>
        <Text style={{ color: colors.defaultText, fontSize: 16 }}>
          Make the app feel right on this device.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <Text style={{ color: colors['pastel-green-1'], fontSize: 14, fontWeight: '600' }}>
          Appearance
        </Text>
        {choices.map((choice) => {
          const selected = choice.value === preference
          return (
            <Pressable
              accessibilityRole='radio'
              accessibilityState={{ selected }}
              key={choice.value}
              onPress={() => setPreference(choice.value)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: selected ? colors['pastel-green-1'] : `${colors['pastel-green-2']}55`,
                backgroundColor: colors.darkerBg,
                opacity: pressed ? 0.8 : 1
              })}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: colors['pastel-green-1'],
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                {selected ? (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: colors['pastel-green-1']
                    }}
                  />
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: colors['pastel-green-1'], fontSize: 16, fontWeight: '600' }}>
                  {choice.label}
                </Text>
                <Text style={{ color: colors.defaultText, fontSize: 14 }}>
                  {choice.description}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </SafeAreaView>
  )
}
