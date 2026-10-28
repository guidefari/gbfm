import { Text, View } from 'react-native'

import type { Tweet } from '@/api/tweets'
import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'
import { containsMusic } from '@/tweets/tweetContent'
import { keyedParagraphs } from '@/tweets/tweetText'

import { TweetBlocks } from './TweetBlocks'
import { TweetMusicCard } from './TweetMusicCard'

export function TweetBody({ tweet, size = 'base' }: { tweet: Tweet; size?: 'base' | 'sm' }) {
  const colors = useThemeColors()
  const fontSize = size === 'base' ? 17 : 14
  const blocks = tweet.richContent?.blocks ?? []

  const paragraphs = [
    tweet.title ?? '',
    ...(blocks.length > 0 ? [] : (tweet.content ?? '').split(/\n{2,}/)),
  ].flatMap((value) => (value.trim() ? [value.trim()] : []))

  return (
    <View style={{ gap: 10 }}>
      {keyedParagraphs(paragraphs).map(({ key, text }) => (
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
      {blocks.length > 0 ? <TweetBlocks blocks={blocks} size={fontSize} /> : null}
      {tweet.music && !containsMusic(blocks, tweet.music.entity.id) ? (
        <TweetMusicCard key={tweet.music.entity.id} music={tweet.music} />
      ) : null}
    </View>
  )
}
