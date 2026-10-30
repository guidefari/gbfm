import { browseExcerpt } from '@gbfm/core/tweet-browse'
import { radii } from '@gbfm/theme'
import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'

import type { Tweet } from '@/api/tweets'
import { useThemeColors, withAlpha } from '@/theme/colors'
import { fonts } from '@/theme/fonts'
import { formatTweetDate, replyCountLabel } from '@/tweets/tweetText'

export function BrowseTweetRow({
  tweet,
  onPress,
}: {
  readonly tweet: Tweet
  readonly onPress: () => void
}) {
  const colors = useThemeColors()
  const [failed, setFailed] = useState(false)
  const music = tweet.music?.entity
  const excerpt = browseExcerpt(tweet)

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={`Read tweet: ${excerpt || music?.title || 'Untitled'}`}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 20,
        gap: 10,
        borderBottomWidth: 1,
        borderColor: withAlpha(colors.muted, 0.2),
        opacity: pressed ? 0.6 : 1,
      })}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
        <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 12 }}>
          {formatTweetDate(tweet.createdAt)}
        </Text>
        {(tweet.replyCount ?? 0) > 0 ? (
          <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 11 }}>
            {replyCountLabel(tweet.replyCount ?? 0)}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ flex: 1, gap: 10 }}>
          <Text
            numberOfLines={4}
            style={{ color: colors.strong, fontFamily: fonts.mono, fontSize: 15, lineHeight: 22 }}>
            {excerpt || music?.title || 'Open tweet'}
          </Text>
          {music ? (
            <Text
              numberOfLines={2}
              style={{
                color: colors.accent,
                fontFamily: fonts.mono,
                fontSize: 12,
                lineHeight: 18,
              }}>
              {music.title}
              {music.artistNames?.length ? ` · ${music.artistNames.join(', ')}` : ''}
            </Text>
          ) : null}
          {tweet.tags?.length ? (
            <Text
              numberOfLines={1}
              style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 11 }}>
              {tweet.tags
                .slice(0, 3)
                .map((tag) => `#${tag}`)
                .join('  ')}
            </Text>
          ) : null}
        </View>
        {music?.coverImageUrl && !failed ? (
          <Image
            source={{ uri: music.coverImageUrl }}
            accessibilityLabel={`${music.title} cover`}
            onError={() => setFailed(true)}
            style={{ width: 72, height: 72, borderRadius: radii.artwork }}
          />
        ) : null}
      </View>
    </Pressable>
  )
}
