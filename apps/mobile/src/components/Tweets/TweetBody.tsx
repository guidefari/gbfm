import { Text, View } from 'react-native'

import type { Tweet } from '@/api/tweets'
import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'
import { keyedParagraphs, tweetParagraphs } from '@/tweets/tweetText'

export function TweetBody({ tweet, size = 'base' }: { tweet: Tweet; size?: 'base' | 'sm' }) {
  const colors = useThemeColors()
  const fontSize = size === 'base' ? 17 : 14

  return (
    <View style={{ gap: 10 }}>
      {keyedParagraphs(tweetParagraphs(tweet)).map(({ key, text }) => (
        <Text
          key={key}
          selectable
          style={{
            color: colors.strong,
            fontFamily: fonts.mono,
            fontSize,
            lineHeight: fontSize * 1.45,
          }}>
          {text}
        </Text>
      ))}
    </View>
  )
}
