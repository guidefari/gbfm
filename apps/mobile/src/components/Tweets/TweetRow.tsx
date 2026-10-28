import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

import type { Tweet } from '@/api/tweets'
import { withAlpha, useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'
import { replyCountLabel, tweetSnippet } from '@/tweets/tweetText'

import { TweetAuthor } from './TweetAuthor'

export function TweetRow({ tweet }: { tweet: Tweet }) {
  const router = useRouter()
  const colors = useThemeColors()
  const snippet = tweetSnippet(tweet, 280)
  const replyCount = tweet.replyCount ?? 0

  const meta = [
    tweet.musicEntityType,
    replyCount > 0 ? replyCountLabel(replyCount) : null,
    ...(tweet.tags ?? []).slice(0, 2).map((tag) => `#${tag}`),
  ].filter(Boolean)

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityHint='Opens the tweet'
      onPress={() => router.push({ pathname: '/tweet/[slug]', params: { slug: tweet.slug } })}
      style={({ pressed }) => ({
        gap: 10,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: withAlpha(colors.muted, 0.25),
        opacity: pressed ? 0.7 : 1,
      })}>
      <TweetAuthor creator={tweet.creators?.[0]} createdAt={tweet.createdAt} />
      {snippet ? (
        <Text
          numberOfLines={6}
          style={{
            color: colors.strong,
            fontFamily: fonts.mono,
            fontSize: 15,
            lineHeight: 22,
          }}>
          {snippet}
        </Text>
      ) : null}
      {meta.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {meta.map((item) => (
            <Text key={item} style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 12 }}>
              {item}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  )
}
