import { brandDark, brandLight } from '@gbfm/theme'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { DynamicColorIOS, useColorScheme } from 'react-native'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { MiniPlayerBar } from '@/components/NowPlaying/MiniPlayerBar'
import { useColorSchemePreference } from '@/store/preferences'

export default function TabsLayout() {
  const systemColorScheme = useColorScheme()
  const preference = useColorSchemePreference()
  const colorScheme = preference === 'system' ? systemColorScheme : preference
  const isDark = colorScheme !== 'light'
  const contentBackground = isDark ? brandDark.bg : brandLight.bg
  const { track } = useNowPlaying()

  return (
    <NativeTabs
      blurEffect='systemDefault'
      minimizeBehavior='onScrollDown'
      tintColor={DynamicColorIOS({ dark: '#FFFFFF', light: brandDark.bg })}
      labelStyle={{ color: DynamicColorIOS({ dark: '#FFFFFF', light: brandDark.bg }) }}>
      {track ? (
        <NativeTabs.BottomAccessory>
          <MiniPlayerBar />
        </NativeTabs.BottomAccessory>
      ) : null}
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
    </NativeTabs>
  )
}
