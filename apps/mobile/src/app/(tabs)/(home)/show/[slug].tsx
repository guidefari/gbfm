import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import { AsyncResult } from 'effect/unstable/reactivity'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native'
import type { ShowEpisode } from '@/api/shows'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { Screen } from '@/components/Screen'
import { episodesFamily } from '@/store/atoms/episodes'
import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'

function EpisodeRow({ episode, onEnqueue }: { episode: ShowEpisode; onEnqueue: () => void }) {
  const { loadAndPlay, togglePlayback, track } = useNowPlaying()
  const router = useRouter()
  const colors = useThemeColors()
  const isCurrent = track?.id === episode.id

  const handlePress = () => {
    if (isCurrent) {
      togglePlayback()
      return
    }
    loadAndPlay(episode)
    router.push('/now-playing')
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 4
      }}>
      <Pressable
        accessibilityRole='button'
        onPress={handlePress}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 6,
          opacity: pressed ? 0.8 : 1
        })}>
        {episode.thumbnailUrl ? (
          <Image
            source={{ uri: episode.thumbnailUrl }}
            style={{ width: 56, height: 56, borderRadius: 4 }}
            resizeMode='cover'
          />
        ) : (
          <View
            style={{ width: 56, height: 56, borderRadius: 4, backgroundColor: colors.surface }}
          />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: isCurrent ? colors.accent : colors.overlayText,
              fontFamily: fonts.monoSemiBold,
              fontSize: 14
            }}
            numberOfLines={2}>
            {episode.title}
          </Text>
          {episode.episodeNumber !== null ? (
            <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 11 }}>
              episode {episode.episodeNumber}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole='button'
        accessibilityLabel='Add to queue'
        hitSlop={8}
        onPress={onEnqueue}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          borderWidth: 1,
          borderColor: `${colors.muted}55`,
          opacity: pressed ? 0.6 : 1
        })}>
        <Text style={{ color: colors.accent, fontFamily: fonts.monoSemiBold, fontSize: 16 }}>
          +
        </Text>
      </Pressable>
    </View>
  )
}

export default function ShowScreen() {
  const { slug, title } = useLocalSearchParams<{ slug: string; title?: string }>()
  const episodesAtom = episodesFamily(slug)
  const result = useAtomValue(episodesAtom)
  const refresh = useAtomRefresh(episodesAtom)
  const { enqueueAll, playAll } = useNowPlaying()
  const router = useRouter()
  const colors = useThemeColors()

  const handlePlayAll = () => {
    if (AsyncResult.isSuccess(result) && result.value.length > 0) {
      playAll(result.value)
      router.push('/now-playing')
    }
  }

  const handleEnqueueAll = () => {
    if (AsyncResult.isSuccess(result) && result.value.length > 0) {
      enqueueAll(result.value)
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: title ?? '' }} />
      <View style={{ flex: 1, backgroundColor: colors.background }} collapsable={false}>
        {AsyncResult.isInitial(result) || AsyncResult.isWaiting(result) ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size='large' color={colors.accent} />
          </View>
        ) : AsyncResult.isSuccess(result) && result.value.length > 0 ? (
          <FlatList
            data={result.value}
            keyExtractor={(episode) => episode.id}
            renderItem={({ item }) => (
              <EpisodeRow episode={item} onEnqueue={() => enqueueAll([item])} />
            )}
            ListHeaderComponent={
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <Pressable
                  accessibilityRole='button'
                  onPress={handlePlayAll}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    backgroundColor: colors.accent,
                    opacity: pressed ? 0.85 : 1
                  })}>
                  <Text
                    style={{
                      color: colors.surface,
                      fontFamily: fonts.monoSemiBold,
                      fontSize: 14,
                      letterSpacing: 0.5
                    }}>
                    Play all
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole='button'
                  onPress={handleEnqueueAll}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: colors.accent,
                    opacity: pressed ? 0.85 : 1
                  })}>
                  <Text
                    style={{
                      color: colors.accent,
                      fontFamily: fonts.monoSemiBold,
                      fontSize: 14,
                      letterSpacing: 0.5
                    }}>
                    Queue all
                  </Text>
                </Pressable>
              </View>
            }
            contentInsetAdjustmentBehavior='automatic'
            contentContainerStyle={{ padding: 20 }}
          />
        ) : AsyncResult.isSuccess(result) ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 14 }}>
              no episodes yet
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 14 }}>
              couldn't load episodes
            </Text>
            <Pressable
              accessibilityRole='button'
              onPress={refresh}
              style={({ pressed }) => ({
                borderWidth: 2,
                borderColor: colors.accent,
                borderRadius: 4,
                paddingHorizontal: 20,
                paddingVertical: 10,
                opacity: pressed ? 0.7 : 1
              })}>
              <Text style={{ color: colors.accent, fontFamily: fonts.monoSemiBold, fontSize: 14 }}>
                retry
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  )
}
