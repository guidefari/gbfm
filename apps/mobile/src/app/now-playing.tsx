import { brand } from '@gbfm/theme'
import { useRouter } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import { useRef } from 'react'
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-screens/experimental'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { QueueSheet } from '@/components/NowPlaying/QueueSheet'
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
  const {
    track,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    togglePlayback,
    seekTo,
    skipNext,
    skipPrevious,
    queue
  } = useNowPlaying()
  const router = useRouter()

  const canSkipPrev = queue.currentIndex > 0
  const canSkipNext = queue.currentIndex >= 0 && queue.currentIndex + 1 < queue.tracks.length
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0
  const scrubWidthRef = useRef(0)
  const displayTrack = track ?? queue.current
  const displayCreators = displayTrack?.creators ?? []

  const handleScrubLayout = (event: LayoutChangeEvent) => {
    scrubWidthRef.current = event.nativeEvent.layout.width
  }

  const handleScrub = (x: number) => {
    const width = scrubWidthRef.current
    if (width > 0 && duration > 0) {
      const ratio = Math.max(0, Math.min(1, x / width))
      seekTo(ratio * duration)
    }
  }

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

      {!displayTrack ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, textAlign: 'center' }}>
            Nothing playing yet. Pick a mix from Home to get started.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}>
          <View
            style={{
              aspectRatio: 1,
              borderWidth: 2,
              borderColor: colors.accent,
              borderRadius: 4,
              overflow: 'hidden',
              alignSelf: 'center',
              width: '100%',
              maxWidth: 360
            }}>
            {displayTrack.thumbnailUrl ? (
              <Image
                source={{ uri: displayTrack.thumbnailUrl }}
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
              {displayTrack.title}
            </Text>
            {displayCreators.length ? (
              <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 14 }}>
                {displayCreators.map((creator) => creator.name).join(', ')}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            <Pressable
              accessibilityRole='adjustable'
              accessibilityValue={{ min: 0, max: 1, now: Math.round(progress * 100) }}
              onPress={(event) => handleScrub(event.nativeEvent.locationX)}
              onLayout={handleScrubLayout}
              style={({ pressed }) => ({
                height: 24,
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1
              })}>
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
                    width: `${progress * 100}%`,
                    backgroundColor: colors.accent
                  }}
                />
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 12 }}>
                {formatTime(currentTime)}
              </Text>
              <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 12 }}>
                {formatTime(duration)}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24
            }}>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Previous track'
              disabled={!canSkipPrev}
              hitSlop={12}
              onPress={skipPrevious}
              style={({ pressed }) => ({
                width: 56,
                height: 56,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                borderWidth: 2,
                borderColor: canSkipPrev ? colors.accent : `${colors.muted}55`,
                opacity: pressed ? 0.85 : 1
              })}>
              <SymbolView
                name='backward.end.fill'
                size={22}
                tintColor={canSkipPrev ? colors.accent : colors.muted}
              />
            </Pressable>

            <Pressable
              accessibilityRole='button'
              accessibilityLabel={isBuffering ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
              onPress={togglePlayback}
              style={({ pressed }) => ({
                width: 88,
                height: 88,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                backgroundColor: colors.accent,
                opacity: pressed ? 0.85 : 1
              })}>
              {isBuffering ? (
                <ActivityIndicator size='large' color={colors.surface} />
              ) : (
                <SymbolView
                  name={isPlaying ? 'pause.fill' : 'play.fill'}
                  size={32}
                  tintColor={colors.surface}
                />
              )}
            </Pressable>

            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Next track'
              disabled={!canSkipNext}
              hitSlop={12}
              onPress={skipNext}
              style={({ pressed }) => ({
                width: 56,
                height: 56,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                borderWidth: 2,
                borderColor: canSkipNext ? colors.accent : `${colors.muted}55`,
                opacity: pressed ? 0.85 : 1
              })}>
              <SymbolView
                name='forward.end.fill'
                size={22}
                tintColor={canSkipNext ? colors.accent : colors.muted}
              />
            </Pressable>
          </View>

          <QueueSheet />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
