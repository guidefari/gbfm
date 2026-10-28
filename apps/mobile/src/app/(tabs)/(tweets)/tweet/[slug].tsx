import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import { AsyncResult } from 'effect/reactivity'
import { useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'

import { TweetDetail } from '@/components/Tweets/TweetDetail'
import { TweetsStatus } from '@/components/Tweets/TweetsStatus'
import { tweetScreenFamily } from '@/store/atoms/tweets'
import { useThemeColors } from '@/theme/colors'

export default function TweetScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const screenAtom = tweetScreenFamily(slug)
  const result = useAtomValue(screenAtom)
  const refresh = useAtomRefresh(screenAtom)
  const colors = useThemeColors()

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} collapsable={false}>
      {AsyncResult.isSuccess(result) ? (
        <TweetDetail
          post={result.value.post}
          parent={result.value.post.parentPostId ? result.value.root : null}
          quote={result.value.quote}
          replies={result.value.replies}
        />
      ) : AsyncResult.isFailure(result) ? (
        <TweetsStatus kind='error' message="couldn't load this tweet" onRetry={refresh} />
      ) : (
        <TweetsStatus kind='loading' />
      )}
    </View>
  )
}
