import { brand } from '@gbfm/theme'
import { Effect } from 'effect'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native'
import { getShowEpisodes, type ShowEpisode } from '@/api/shows'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { useAsyncAtom } from '@/store/result'
import { fonts } from '@/theme/fonts'

const colors = {
  background: brand.bg,
  accent: brand['pastel-green-1'],
  muted: brand['pastel-green-2'],
  surface: brand.darkerBg
}

function EpisodeRow({ episode }: { episode: ShowEpisode }) {
  const { loadAndPlay, togglePlayback, track } = useNowPlaying()
  const router = useRouter()
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
    <Pressable
      accessibilityRole='button'
      onPress={handlePress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        opacity: pressed ? 0.8 : 1
      })}>
      {episode.thumbnailUrl ? (
        <Image
          source={{ uri: episode.thumbnailUrl }}
          style={{ width: 56, height: 56, borderRadius: 4 }}
          resizeMode='cover'
        />
      ) : (
        <View style={{ width: 56, height: 56, borderRadius: 4, backgroundColor: colors.surface }} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: isCurrent ? colors.accent : '#FFFFFF',
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
  )
}

export default function ShowScreen() {
  const { slug, title } = useLocalSearchParams<{ slug: string; title?: string }>()
  const {
    status,
    value: episodes,
    refresh: fetchEpisodes
  } = useAsyncAtom(
    () =>
      getShowEpisodes(slug).pipe(
        Effect.tapError((error) =>
          Effect.sync(() => console.error('getShowEpisodes failed', error))
        )
      ),
    [slug]
  )

  return (
    <>
      <Stack.Screen options={{ title: title ?? '' }} />
      <View style={{ flex: 1, backgroundColor: colors.background }} collapsable={false}>
        {status === 'pending' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size='large' color={colors.accent} />
          </View>
        ) : status === 'success' && episodes.length > 0 ? (
          <FlatList
            data={episodes}
            keyExtractor={(episode) => episode.id}
            renderItem={({ item }) => <EpisodeRow episode={item} />}
            contentInsetAdjustmentBehavior='automatic'
            contentContainerStyle={{ padding: 20 }}
          />
        ) : status === 'success' ? (
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
              onPress={fetchEpisodes}
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
    </>
  )
}
