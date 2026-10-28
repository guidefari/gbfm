import { useState } from 'react'
import { Linking, Pressable, Text } from 'react-native'

import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'
import { tweetLinkUrl } from '@/tweets/tweetContent'

export function useTweetLink(href: string) {
  const [failed, setFailed] = useState(false)

  const open = async () => {
    const url = tweetLinkUrl(href)

    if (!url) {
      setFailed(true)

      return
    }

    try {
      await Linking.openURL(url)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }

  return { open, failed }
}

export function TweetLink({ href, label }: { readonly href: string; readonly label: string }) {
  const colors = useThemeColors()
  const { open, failed } = useTweetLink(href)

  return (
    <>
      <Pressable
        accessibilityRole='link'
        accessibilityLabel={label}
        onPress={() => void open()}
        style={({ pressed }) => ({
          minHeight: 44,
          paddingHorizontal: 12,
          justifyContent: 'center',
          borderRadius: 4,
          borderWidth: 1,
          borderColor: colors.muted,
          opacity: pressed ? 0.6 : 1,
        })}>
        <Text style={{ color: colors.accent, fontFamily: fonts.monoSemiBold, fontSize: 12 }}>
          {label} ↗
        </Text>
      </Pressable>
      {failed ? (
        <Text
          accessibilityRole='alert'
          style={{ color: colors.strong, fontFamily: fonts.mono, fontSize: 12 }}>
          Couldn't open this link. Tap to try again.
        </Text>
      ) : null}
    </>
  )
}
