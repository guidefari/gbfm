import { browseMonthLabel } from '@gbfm/core/tweet-browse'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, RefreshControl, Text, View } from 'react-native'

import { BrowseDateFilter } from '@/components/Tweets/BrowseDateFilter'
import { BrowseTweetRow } from '@/components/Tweets/BrowseTweetRow'
import { ReaderButton } from '@/components/Tweets/ReaderButton'
import { TweetsStatus } from '@/components/Tweets/TweetsStatus'
import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'
import { useTweetBrowse } from '@/tweets/useTweetBrowse'

export default function TweetsArchive() {
  const colors = useThemeColors()
  const router = useRouter()
  const [month, setMonth] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const browse = useTweetBrowse(null, month, page)
  const data = browse.data

  const empty = {
    error: <TweetsStatus kind='error' message="Couldn't load tweets" onRetry={browse.refresh} />,
    loading: <TweetsStatus kind='loading' />,
    ready: <TweetsStatus kind='empty' message='No tweets in this date range.' />,
  }[browse.status]

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        key={`${month}:${page}`}
        contentInsetAdjustmentBehavior='automatic'
        data={data?.posts ?? []}
        keyExtractor={(tweet) => tweet.id}
        renderItem={({ item, index }) => (
          <>
            {index === 0 ||
            data?.posts[index - 1]?.createdAt.slice(0, 7) !== item.createdAt.slice(0, 7) ? (
              <Text
                style={{
                  paddingTop: 24,
                  color: colors.muted,
                  fontFamily: fonts.monoSemiBold,
                  fontSize: 12,
                }}>
                {browseMonthLabel(item.createdAt.slice(0, 7))}
              </Text>
            ) : null}
            <BrowseTweetRow
              tweet={item}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/(tweets)/tweet/[slug]',
                  params: { slug: item.slug },
                })
              }
            />
          </>
        )}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingTop: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}>
              <BrowseDateFilter
                timeline={data?.timeline ?? []}
                selected={data ? data.month : month}
                onSelect={(value) => {
                  setMonth(value)
                  setPage(0)
                }}
              />
              <ReaderButton
                label='Back to reader'
                quiet
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace('/(tabs)/(tweets)')
                }
              />
            </View>
            {data ? (
              <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 11 }}>
                {data.total} {data.total === 1 ? 'tweet' : 'tweets'} · newest first
              </Text>
            ) : null}
            {data && !data.datesAvailable ? (
              <ReaderButton label='Retry date filters' quiet onPress={browse.refresh} />
            ) : null}
          </View>
        }
        ListEmptyComponent={empty}
        ListFooterComponent={
          data ? (
            <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 24 }}>
              {data.page > 0 ? (
                <ReaderButton label='Newer tweets' onPress={() => setPage(data.page - 1)} />
              ) : null}
              {data.hasMore ? (
                <ReaderButton label='Older tweets' onPress={() => setPage(data.page + 1)} />
              ) : null}
            </View>
          ) : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={browse.status === 'loading' && data !== null}
            onRefresh={browse.refresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}
      />
    </View>
  )
}
