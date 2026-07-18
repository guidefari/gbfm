import '../global.css'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { DynamicColorIOS, useColorScheme } from 'react-native'
import { useColorSchemePreference } from '@/store/preferences'

// import { env } from '@/env'
// import { FPSMeter } from '@/fpsmeter'

export default function Layout() {
  const systemColorScheme = useColorScheme()
  const preference = useColorSchemePreference()
  const colorScheme = preference === 'system' ? systemColorScheme : preference
  const isDark = colorScheme !== 'light'
  const contentBackground = isDark ? '#16415A' : '#E8EFF8'

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      {/* {env.isDev && (
        <FPSMeter width={120} height={30} style={{ top: 50, right: 10 }} />
      )} */}
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
        <NativeTabs.Trigger name='profile' contentStyle={{ backgroundColor: contentBackground }}>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
            md={{ default: 'person', selected: 'person' }}
          />
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name='preferences'
          contentStyle={{ backgroundColor: contentBackground }}>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
            md={{ default: 'settings', selected: 'settings' }}
          />
          <NativeTabs.Trigger.Label>Preferences</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  )
}
