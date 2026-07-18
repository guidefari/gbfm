import { brand } from '@gbfm/theme'
import { useRouter } from 'expo-router'
import { Image, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-screens/experimental'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { fonts } from '@/theme/fonts'

const colors = {
  background: brand.bg,
  accent: brand['pastel-green-1'],
  muted: brand['pastel-green-2'],
  text: brand.defaultText,
  surface: brand.darkerBg
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function NowPlaying() {
  const { track, isPlaying, isBuffering, currentTime, duration, togglePlayback } = useNowPlaying()
  const router = useRouter()

  return (
    <SafeAreaView
      edges={{ top: true, left: true, right: true, bottom: true }}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: `${colors.muted}66`,
          marginTop: 8
        }}
      />

      <Pressable
        accessibilityRole='button'
        accessibilityLabel='Close'
        hitSlop={12}
        onPress={() => router.back()}
        style={{ position: 'absolute', top: 16, right: 16, padding: 8 }}>
        <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 14 }}>Close</Text>
      </Pressable>

      {!track ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, textAlign: 'center' }}>
            Nothing playing yet. Pick a mix from Home to get started.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, padding: 24, gap: 24, justifyContent: 'center' }}>
          <View
            style={{
              aspectRatio: 1,
              borderWidth: 2,
              borderColor: colors.accent,
              borderRadius: 4,
              overflow: 'hidden'
            }}>
            {track.thumbnailUrl ? (
              <Image
                source={{ uri: track.thumbnailUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode='cover'
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: colors.surface }} />
            )}
          </View>

          <View style={{ gap: 4 }}>
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: fonts.monoSemiBold,
                fontSize: 22,
                textDecorationLine: 'underline',
                textDecorationColor: colors.accent
              }}
              numberOfLines={2}>
              {track.title}
            </Text>
            {track.creators?.length ? (
              <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 14 }}>
                {track.creators.map((creator) => creator.name).join(', ')}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            <View
              style={{
                height: 4,
                backgroundColor: `${colors.muted}44`,
                borderRadius: 2,
                overflow: 'hidden'
              }}>
              <View
                style={{
                  height: '100%',
                  width: `${Math.min(duration > 0 ? currentTime / duration : 0, 1) * 100}%`,
                  backgroundColor: colors.accent
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 12 }}>
                {formatTime(currentTime)}
              </Text>
              <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 12 }}>
                {formatTime(duration)}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole='button'
            onPress={togglePlayback}
            style={({ pressed }) => ({
              minHeight: 56,
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
                fontSize: 15,
                letterSpacing: 1
              }}>
              {isBuffering ? 'Buffering…' : isPlaying ? 'Pause' : 'Play'}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  )
}
