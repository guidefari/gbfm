import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import { AsyncResult } from 'effect/reactivity'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text } from 'react-native'

import { Screen } from '@/components/Screen'
import { TweetRow } from '@/components/Tweets/TweetRow'
import { TweetsStatus } from '@/components/Tweets/TweetsStatus'
import { tweetsAtom } from '@/store/atoms/tweets'
import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'
import { useTweetPages } from '@/tweets/useTweetPages'

function TweetsHeading() {
  const colors = useThemeColors()

  return (
    <Text
      accessibilityRole='header'
      style={{
        color: colors.accent,
        fontFamily: fonts.monoSemiBold,
        fontSize: 22,
        lineHeight: 26,
        paddingTop: 4,
        paddingBottom: 4,
      }}>
      tweets
    </Text>
  )
}

function TweetsFooter({
  status,
  onRetry,
}: {
  status: 'idle' | 'loading' | 'failed'
  onRetry: () => void
}) {
  const colors = useThemeColors()

  if (status === 'loading') {
    return <ActivityIndicator color={colors.accent} style={{ paddingVertical: 20 }} />
  }

  if (status === 'failed') {
    return (
      <Pressable
        accessibilityRole='button'
        onPress={onRetry}
        style={({ pressed }) => ({ paddingVertical: 20, opacity: pressed ? 0.7 : 1 })}>
        <Text
          style={{
            color: colors.accent,
            fontFamily: fonts.monoSemiBold,
            fontSize: 13,
            textAlign: 'center',
          }}>
          couldn't load more, tap to retry
        </Text>
      </Pressable>
    )
  }

  return null
}

export default function Tweets() {
  const result = useAtomValue(tweetsAtom)
  const refresh = useAtomRefresh(tweetsAtom)
  const colors = useThemeColors()
  const firstPage = AsyncResult.isSuccess(result) ? result.value : null
  const { tweets, status, loadMore } = useTweetPages(firstPage)

  return (
    <Screen>
      <FlatList
        data={tweets}
        keyExtractor={(tweet) => tweet.id}
        renderItem={({ item }) => <TweetRow tweet={item} />}
        ListHeaderComponent={TweetsHeading}
        ListEmptyComponent={
          firstPage ? (
            <TweetsStatus kind='empty' message='no tweets yet' />
          ) : AsyncResult.isFailure(result) ? (
            <TweetsStatus kind='error' message="couldn't load tweets" onRetry={refresh} />
          ) : (
            <TweetsStatus kind='loading' />
          )
        }
        ListFooterComponent={<TweetsFooter status={status} onRetry={loadMore} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={firstPage !== null && AsyncResult.isWaiting(result)}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}
      />
    </Screen>
  )
}
