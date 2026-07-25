import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { DynamicColorIOS, Platform, useColorScheme } from 'react-native'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { MiniPlayerBar } from '@/components/NowPlaying/MiniPlayerBar'
import { useThemeColors } from '@/theme/colors'
import { useColorSchemePreference } from '@/store/preferences'

export default function TabsLayout() {
  const colors = useThemeColors()
  const systemColorScheme = useColorScheme()
  const preference = useColorSchemePreference()
  const colorScheme = preference === 'system' ? systemColorScheme : preference
  const { track } = useNowPlaying()

  const tabColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ dark: colors.overlayText, light: colors.background })
      : colorScheme === 'light'
        ? colors.background
        : colors.overlayText

  return (
    <NativeTabs
      blurEffect='systemDefault'
      minimizeBehavior='onScrollDown'
      tintColor={tabColor}
      labelStyle={{ color: tabColor }}>
      {track ? (
        <NativeTabs.BottomAccessory>
          <MiniPlayerBar />
        </NativeTabs.BottomAccessory>
      ) : null}
      <NativeTabs.Trigger name='(home)' contentStyle={{ backgroundColor: colors.background }}>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md={{ default: 'home', selected: 'home_filled' }}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name='profile' contentStyle={{ backgroundColor: colors.background }}>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md={{ default: 'person', selected: 'person' }}
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
