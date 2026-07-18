import '../global.css'
import { useFonts } from 'expo-font'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { DynamicColorIOS, useColorScheme } from 'react-native'
import { AudioProvider } from '@/audio/AudioProvider'
import { AuthProvider } from '@/store/auth'
import { useColorSchemePreference } from '@/store/preferences'

void SplashScreen.preventAutoHideAsync()

export default function Layout() {
  const systemColorScheme = useColorScheme()
  const preference = useColorSchemePreference()
  const colorScheme = preference === 'system' ? systemColorScheme : preference
  const isDark = colorScheme !== 'light'
  const contentBackground = isDark ? '#16415A' : '#E8EFF8'

  const [fontsLoaded] = useFonts({
    JetBrainsMono: require('../../assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-SemiBold': require('../../assets/fonts/JetBrainsMono-SemiBold.ttf')
  })

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <AudioProvider>
      <AuthProvider>
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
          <NativeTabs
            blurEffect='systemDefault'
            minimizeBehavior='onScrollDown'
            tintColor={DynamicColorIOS({ dark: '#FFFFFF', light: '#16415A' })}
            labelStyle={{ color: DynamicColorIOS({ dark: '#FFFFFF', light: '#16415A' }) }}>
            <NativeTabs.Trigger name='index' contentStyle={{ backgroundColor: contentBackground }}>
              <NativeTabs.Trigger.Icon
                sf={{ default: 'house', selected: 'house.fill' }}
                md={{ default: 'home', selected: 'home_filled' }}
              />
              <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger
              name='profile'
              contentStyle={{ backgroundColor: contentBackground }}>
              <NativeTabs.Trigger.Icon
                sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
                md={{ default: 'person', selected: 'person' }}
              />
              <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
          </NativeTabs>
        </ThemeProvider>
      </AuthProvider>
    </AudioProvider>
  )
}
