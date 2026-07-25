import { useRouter } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import { useRef } from 'react'
import type { AccessibilityActionEvent, LayoutChangeEvent } from 'react-native'
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-screens/experimental'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { QueueSheet } from '@/components/NowPlaying/QueueSheet'
import { useThemeColors, withAlpha } from '@/theme/colors'
import { fonts } from '@/theme/fonts'

const symbols = {
  previous: { ios: 'backward.end.fill', android: 'skip_previous', web: 'skip_previous' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  next: { ios: 'forward.end.fill', android: 'skip_next', web: 'skip_next' },
  artwork: { ios: 'music.note', android: 'music_note', web: 'music_note' }
} as const

const SEEK_STEP_SECONDS = 15

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
  const colors = useThemeColors()

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

  const handleScrubAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') {
      seekTo(Math.min(duration, currentTime + SEEK_STEP_SECONDS))
    } else if (event.nativeEvent.actionName === 'decrement') {
      seekTo(Math.max(0, currentTime - SEEK_STEP_SECONDS))
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
          backgroundColor: withAlpha(colors.muted, 0.45),
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
          contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 8, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}>
          <View style={{ width: '100%', maxWidth: 340, alignSelf: 'center', gap: 24 }}>
            <View
              style={{
                aspectRatio: 1,
                borderRadius: 12,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: withAlpha(colors.accent, 0.2),
                backgroundColor: colors.surface,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 6
              }}>
              {displayTrack.thumbnailUrl ? (
                <Image
                  source={{ uri: displayTrack.thumbnailUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode='cover'
                />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <SymbolView
                    name={symbols.artwork}
                    size={48}
                    tintColor={withAlpha(colors.muted, 0.6)}
                  />
                </View>
              )}
            </View>

            <View style={{ gap: 6 }}>
              <Text
                style={{
                  color: colors.strong,
                  fontFamily: fonts.monoSemiBold,
                  fontSize: 20,
                  lineHeight: 26
                }}
                numberOfLines={2}>
                {displayTrack.title}
              </Text>
              {displayCreators.length ? (
                <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 13 }}>
                  {displayCreators.map((creator) => creator.name).join(', ')}
                </Text>
              ) : null}
            </View>

            <View style={{ gap: 6 }}>
              <Pressable
                accessibilityRole='adjustable'
                accessibilityLabel='Playback position'
                accessibilityHint='Tap to seek, or swipe up and down to seek 15 seconds'
                accessibilityValue={{
                  min: 0,
                  max: Math.max(0, Math.round(duration)),
                  now: Math.max(0, Math.min(Math.round(duration), Math.round(currentTime))),
                  text: `${formatTime(currentTime)} of ${formatTime(duration)}`
                }}
                accessibilityActions={[
                  { name: 'increment', label: 'Seek forward 15 seconds' },
                  { name: 'decrement', label: 'Seek backward 15 seconds' }
                ]}
                onAccessibilityAction={handleScrubAccessibilityAction}
                onPress={(event) => handleScrub(event.nativeEvent.locationX)}
                onLayout={handleScrubLayout}
                style={({ pressed }) => ({
                  height: 44,
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1
                })}>
                <View
                  style={{
                    height: 4,
                    backgroundColor: withAlpha(colors.muted, 0.3),
                    borderRadius: 2
                  }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${progress * 100}%`,
                      borderRadius: 2,
                      backgroundColor: colors.accent
                    }}
                  />
                </View>
                <View
                  style={{
                    position: 'absolute',
                    left: `${progress * 100}%`,
                    marginLeft: -7,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: colors.accent,
                    borderWidth: 2,
                    borderColor: colors.background
                  }}
                />
              </Pressable>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 11 }}>
                  {formatTime(currentTime)}
                </Text>
                <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 11 }}>
                  {formatTime(duration)}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 40
              }}>
              <Pressable
                accessibilityRole='button'
                accessibilityLabel='Previous track'
                disabled={!canSkipPrev}
                hitSlop={12}
                onPress={skipPrevious}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: !canSkipPrev ? 0.35 : pressed ? 0.6 : 1
                })}>
                <SymbolView name={symbols.previous} size={26} tintColor={colors.accent} />
              </Pressable>

              <Pressable
                accessibilityRole='button'
                accessibilityLabel={isBuffering ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
                onPress={togglePlayback}
                style={({ pressed }) => ({
                  width: 72,
                  height: 72,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 36,
                  backgroundColor: colors.accent,
                  opacity: pressed ? 0.85 : 1
                })}>
                {isBuffering ? (
                  <ActivityIndicator size='large' color={colors.onAccent} />
                ) : (
                  <SymbolView
                    name={isPlaying ? symbols.pause : symbols.play}
                    size={30}
                    tintColor={colors.onAccent}
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
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: !canSkipNext ? 0.35 : pressed ? 0.6 : 1
                })}>
                <SymbolView name={symbols.next} size={26} tintColor={colors.accent} />
              </Pressable>
            </View>

            <QueueSheet />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
