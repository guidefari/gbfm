import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'

import { useAuthStore } from '@/store/auth'
import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'
import { readerMonth } from '@/tweets/readerState'
import { useTweetReader } from '@/tweets/useTweetReader'

import { ReaderButton } from './ReaderButton'
import { ReaderOptions } from './ReaderOptions'
import { TweetDetail } from './TweetDetail'
import { TweetsStatus } from './TweetsStatus'

function Reader({
  identity,
  sessionToken,
  initialSlug,
}: {
  readonly identity: string
  readonly sessionToken: string | null
  readonly initialSlug: string | undefined
}) {
  const colors = useThemeColors()
  const router = useRouter()
  const reader = useTweetReader(identity, sessionToken, initialSlug)
  const [options, setOptions] = useState(false)
  const { screen, navigation } = reader

  const go = (slug: string | null) => {
    setOptions(false)
    reader.go(slug)
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {reader.status === 'loading' ? (
        <TweetsStatus kind='loading' />
      ) : reader.status === 'error' ? (
        <>
          <TweetsStatus kind='error' message="couldn't load this tweet" onRetry={reader.retry} />
          <ReaderButton label='Latest' onPress={() => go(null)} />
        </>
      ) : !screen ? (
        <TweetsStatus kind='empty' message='no tweets yet' />
      ) : (
        <>
          <TweetDetail
            key={screen.post.id}
            post={screen.post}
            parent={screen.post.parentPostId ? screen.root : null}
            quote={screen.quote}
            replies={screen.replies}
          />
          {reader.progressFailed || reader.notice ? (
            <View style={{ paddingHorizontal: 12, paddingBottom: 8, gap: 6 }}>
              <Text
                accessibilityLiveRegion='polite'
                style={{ color: colors.strong, fontFamily: fonts.mono, fontSize: 12 }}>
                {reader.notice ?? "Couldn't save reading progress."}
              </Text>
              <ReaderButton
                label={reader.progressFailed ? 'Retry reading progress' : 'Reading options'}
                onPress={reader.progressFailed ? reader.retry : () => setOptions(true)}
              />
            </View>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              padding: 8,
              gap: 6,
              borderTopWidth: 1,
              borderColor: colors.muted,
            }}>
            <ReaderButton
              label='Newer'
              glyph='chevronLeft'
              disabled={!navigation?.newer || reader.actionBusy}
              onPress={() => navigation?.newer && go(navigation.newer)}
            />
            <View style={{ flex: 1 }}>
              <ReaderButton
                label={`${readerMonth(screen.post.createdAt)} · ${navigation ? `${navigation.unreadCount} unread` : reader.navigationStatus === 'error' ? 'retry navigation' : 'checking…'}`}
                accessibilityLabel='Reading options'
                onPress={() => setOptions(true)}
              />
            </View>
            <ReaderButton
              label='Older'
              glyph='chevronRight'
              disabled={!navigation?.older || reader.actionBusy}
              onPress={() => navigation?.older && go(navigation.older)}
            />
          </View>
        </>
      )}
      <ReaderOptions
        visible={options}
        navigation={navigation}
        busy={reader.actionBusy}
        failed={reader.navigationStatus === 'error'}
        onClose={() => setOptions(false)}
        onGo={go}
        onRandom={() => {
          setOptions(false)
          reader.random()
        }}
        onReset={() => {
          setOptions(false)
          reader.reset()
        }}
        onRetry={() => {
          setOptions(false)
          reader.retry()
        }}
        onArchive={() => {
          setOptions(false)
          router.push('/(tabs)/(tweets)/archive')
        }}
      />
    </View>
  )
}

export function TweetReader({ initialSlug }: { readonly initialSlug?: string }) {
  const accountId = useAuthStore((auth) => auth.user?.id ?? 'anonymous')
  const sessionToken = useAuthStore((auth) => auth.sessionToken)

  return (
    <Reader
      key={`${accountId}:${initialSlug ?? 'resume'}`}
      identity={accountId}
      sessionToken={sessionToken}
      initialSlug={initialSlug}
    />
  )
}
