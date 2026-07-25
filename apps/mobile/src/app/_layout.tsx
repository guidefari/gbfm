import '../global.css'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { RegistryProvider, useAtomMount } from '@effect/atom-react'
import { brandDark, brandLight } from '@gbfm/theme'
import { useColorScheme } from 'react-native'
import { NowPlayingProvider } from '@/audio/NowPlayingProvider'
import { QueueToast } from '@/components/NowPlaying/QueueToast'
import { SpotifyConnectionProvider } from '@/spotify/connection'
import { FontsLoadedBridge, splashHideAtom, useFontsReady } from '@/store/atoms/fonts'
import { AuthProvider } from '@/store/auth'
import { useColorSchemePreference } from '@/store/preferences'
import { useStackScreenOptions } from '@/theme/navigation'

void SplashScreen.preventAutoHideAsync()

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
  const screenOptions = useStackScreenOptions()

  return (
    <RegistryProvider>
      <FontsLoadedBridge>
        <SplashGate>
          <NowPlayingProvider>
            <AuthProvider>
              <SpotifyConnectionProvider>
                <ThemeProvider value={isDark ? darkTheme : lightTheme}>
                  <StatusBar style={isDark ? 'light' : 'dark'} />
                  <Stack screenOptions={screenOptions}>
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
                  <QueueToast />
                </ThemeProvider>
              </SpotifyConnectionProvider>
            </AuthProvider>
          </NowPlayingProvider>
        </SplashGate>
      </FontsLoadedBridge>
    </RegistryProvider>
  )
}

function SplashGate({ children }: { children: React.ReactNode }) {
  const fontsReady = useFontsReady()
  useAtomMount(splashHideAtom)
  if (!fontsReady) return null
  return <>{children}</>
}
