import '../global.css'
import { useFonts } from 'expo-font'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { brandDark, brandLight } from '@gbfm/theme'
import { useColorScheme } from 'react-native'
import { NowPlayingProvider } from '@/audio/NowPlayingProvider'
import { AuthProvider } from '@/store/auth'
import { useColorSchemePreference } from '@/store/preferences'

void SplashScreen.preventAutoHideAsync()

// Screens reveal the navigation theme background behind the status bar,
// so match it to the brand background instead of the default black/white.
const darkTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: brandDark.bg }
}
const lightTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: brandLight.bg }
}

export default function Layout() {
  const systemColorScheme = useColorScheme()
  const preference = useColorSchemePreference()
  const colorScheme = preference === 'system' ? systemColorScheme : preference
  const isDark = colorScheme !== 'light'

  const [fontsLoaded] = useFonts({
    JetBrainsMono: require('../../assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-SemiBold': require('../../assets/fonts/JetBrainsMono-SemiBold.ttf')
  })

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <NowPlayingProvider>
      <AuthProvider>
        <ThemeProvider value={isDark ? darkTheme : lightTheme}>
          <Stack>
            <Stack.Screen name='(tabs)' options={{ headerShown: false }} />
            <Stack.Screen
              name='now-playing'
              options={{
                presentation: 'modal',
                headerShown: false,
                animation: 'slide_from_bottom',
                contentStyle: { backgroundColor: isDark ? brandDark.bg : brandLight.bg }
              }}
            />
            <Stack.Screen name='music-reminders' options={{ title: 'Music Reminders' }} />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </NowPlayingProvider>
  )
}
