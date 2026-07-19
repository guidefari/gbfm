import { brandDark, brandLight } from '@gbfm/theme'
import { useColorScheme } from 'react-native'
import { useColorSchemePreference } from '@/store/preferences'
import { fonts } from './fonts'

/**
 * Shared Stack screenOptions so pushed screens get a branded header
 * instead of the default React Navigation one (wrong colors, and a back
 * button labelled after the previous route name, e.g. "index").
 */
export function useStackScreenOptions() {
  const systemColorScheme = useColorScheme()
  const preference = useColorSchemePreference()
  const colorScheme = preference === 'system' ? systemColorScheme : preference
  const isDark = colorScheme !== 'light'
  const brand = isDark ? brandDark : brandLight

  return {
    headerStyle: { backgroundColor: brand.bg },
    headerTintColor: brand['pastel-green-1'],
    headerTitleStyle: {
      color: isDark ? '#FFFFFF' : brand.defaultText,
      fontFamily: fonts.monoSemiBold
    },
    headerShadowVisible: false,
    // Chevron-only back button: never show the previous route's name.
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: brand.bg }
  } as const
}
