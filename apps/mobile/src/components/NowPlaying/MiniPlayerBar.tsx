import { brand, brandDark } from '@gbfm/theme'
import { useRouter } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { SymbolView } from 'expo-symbols'
import { ActivityIndicator, DynamicColorIOS, Image, Pressable, Text, View } from 'react-native'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { fonts } from '@/theme/fonts'

const textColor = DynamicColorIOS({ dark: '#FFFFFF', light: brandDark.bg })
const accent = brand['pastel-green-1']

function Artwork({ url, size }: { url: string | null | undefined; size: number }) {
  if (!url) {
    return <View style={{ width: size, height: size, borderRadius: 4, backgroundColor: accent }} />
  }
  return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: 4 }}
      resizeMode='cover'
    />
  )
}

export function MiniPlayerBar() {
  const {
    track,
    isPlaying,
    currentTime,
    duration,
    togglePlayback,
    isBuffering,
    isLoaded,
    skipNext,
    skipPrevious,
    queue
  } = useNowPlaying()
  const router = useRouter()
  const placement = NativeTabs.BottomAccessory.usePlacement()

  if (!track) return null

  const symbolName = isPlaying ? 'pause.fill' : 'play.fill'
  const showSpinner = isBuffering || !isLoaded
  const canSkipPrev = queue.currentIndex > 0
  const canSkipNext = queue.currentIndex >= 0 && queue.currentIndex + 1 < queue.tracks.length

  if (placement === 'inline') {
    return (
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 10
        }}>
        <Pressable
          accessibilityRole='button'
          onPress={() => router.push('/now-playing')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Artwork url={track.thumbnailUrl} size={26} />
          <Text
            style={{ flex: 1, color: textColor, fontFamily: fonts.monoSemiBold, fontSize: 12 }}
            numberOfLines={1}>
            {track.title}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole='button'
          hitSlop={8}
          onPress={skipPrevious}
          disabled={!canSkipPrev}
          style={{
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: canSkipPrev ? 1 : 0.4
          }}>
          <SymbolView name='backward.fill' size={14} tintColor={textColor} />
        </Pressable>
        <Pressable
          accessibilityRole='button'
          hitSlop={8}
          onPress={togglePlayback}
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          {showSpinner ? (
            <ActivityIndicator size='small' color={textColor} />
          ) : (
            <SymbolView name={symbolName} size={16} tintColor={textColor} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole='button'
          hitSlop={8}
          onPress={skipNext}
          disabled={!canSkipNext}
          style={{
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: canSkipNext ? 1 : 0.4
          }}>
          <SymbolView name='forward.fill' size={14} tintColor={textColor} />
        </Pressable>
      </View>
    )
  }

  const creatorNames = track.creators?.map((creator) => creator.name).join(', ')
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 12
        }}>
        <Pressable
          accessibilityRole='button'
          onPress={() => router.push('/now-playing')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Artwork url={track.thumbnailUrl} size={40} />
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: textColor, fontFamily: fonts.monoSemiBold, fontSize: 14 }}
              numberOfLines={1}>
              {track.title}
            </Text>
            {creatorNames ? (
              <Text
                style={{ color: textColor, opacity: 0.55, fontFamily: fonts.mono, fontSize: 11 }}
                numberOfLines={1}>
                {creatorNames}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole='button'
          hitSlop={8}
          onPress={skipPrevious}
          disabled={!canSkipPrev}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: canSkipPrev ? 1 : 0.4
          }}>
          <SymbolView name='backward.fill' size={16} tintColor={textColor} />
        </Pressable>
        <Pressable
          accessibilityRole='button'
          hitSlop={8}
          onPress={togglePlayback}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          {showSpinner ? (
            <ActivityIndicator size='small' color={textColor} />
          ) : (
            <SymbolView name={symbolName} size={22} tintColor={textColor} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole='button'
          hitSlop={8}
          onPress={skipNext}
          disabled={!canSkipNext}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: canSkipNext ? 1 : 0.4
          }}>
          <SymbolView name='forward.fill' size={16} tintColor={textColor} />
        </Pressable>
      </View>
      {progress > 0 ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 12,
            right: 12,
            height: 2,
            borderRadius: 1,
            overflow: 'hidden',
            backgroundColor: DynamicColorIOS({ dark: '#FFFFFF2E', light: `${brandDark.bg}2E` })
          }}>
          <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: accent }} />
        </View>
      ) : null}
    </View>
  )
}
