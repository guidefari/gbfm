import type { AudioResponse } from '@gbfm/api/audio'
import { brand } from '@gbfm/theme'
import { LinearGradient } from 'expo-linear-gradient'
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native'
import { fonts } from '@/theme/fonts'

const colors = {
  accent: brand['pastel-green-1'],
  muted: brand['pastel-green-2'],
  text: brand.defaultText,
  surface: brand.darkerBg
}

// Fixed geometry, mirrored by FeaturedMixSkeleton, so that
// loading -> loaded/error never shifts layout.
export const FEATURED_CARD_INFO_HEIGHT = 78
export const FEATURED_CARD_BUTTON_HEIGHT = 56

const cardContainerStyle = {
  borderWidth: 2,
  borderColor: colors.accent,
  borderRadius: 4,
  overflow: 'hidden',
  backgroundColor: colors.surface
} as const

export function FeaturedMixCard({
  mix,
  isPlaying = false,
  isLoading = false,
  onPressPlay,
  onRetry
}: {
  mix: typeof AudioResponse.Type | null
  isPlaying?: boolean
  isLoading?: boolean
  onPressPlay: () => void
  onRetry?: () => void
}) {
  if (!mix) {
    return (
      <View style={{ ...cardContainerStyle, borderColor: colors.muted }}>
        <View
          style={{
            aspectRatio: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24
          }}>
          <Text
            style={{
              color: colors.muted,
              fontFamily: fonts.mono,
              fontSize: 14,
              textAlign: 'center'
            }}>
            couldn't load the featured mix
          </Text>
        </View>
        <View
          style={{
            height: FEATURED_CARD_INFO_HEIGHT,
            justifyContent: 'center',
            paddingHorizontal: 16
          }}>
          <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 14 }}>
            check your connection and try again
          </Text>
        </View>
        <Pressable
          accessibilityRole='button'
          onPress={onRetry}
          style={({ pressed }) => ({
            height: FEATURED_CARD_BUTTON_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accent,
            opacity: pressed ? 0.85 : 1
          })}>
          <Text
            style={{
              color: colors.surface,
              fontFamily: fonts.monoSemiBold,
              fontSize: 15,
              letterSpacing: 0.5
            }}>
            Retry
          </Text>
        </Pressable>
      </View>
    )
  }

  const creatorNames = mix.creators?.map((creator) => creator.name).join(', ')

  return (
    <View style={cardContainerStyle}>
      <View style={{ aspectRatio: 1 }}>
        {mix.thumbnailUrl ? (
          <Image
            source={{ uri: mix.thumbnailUrl }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            resizeMode='cover'
          />
        ) : null}

        <LinearGradient
          pointerEvents='none'
          colors={['rgba(0,0,0,0.45)', 'transparent']}
          locations={[0, 0.35]}
          style={{ position: 'absolute', inset: 0 }}
        />

        <Text
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            backgroundColor: colors.accent,
            color: colors.surface,
            fontFamily: fonts.monoSemiBold,
            fontSize: 12,
            letterSpacing: 3,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 2
          }}>
          {isPlaying ? 'Now Playing' : 'Featured'}
        </Text>
      </View>

      <View
        style={{
          height: FEATURED_CARD_INFO_HEIGHT,
          justifyContent: 'center',
          gap: 4,
          paddingHorizontal: 16
        }}>
        <Text
          style={{
            color: '#FFFFFF',
            fontFamily: fonts.monoSemiBold,
            fontSize: 20,
            lineHeight: 24,
            textDecorationLine: 'underline',
            textDecorationColor: colors.accent
          }}
          numberOfLines={1}>
          {mix.title}
        </Text>
        <Text
          style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 14, lineHeight: 18 }}
          numberOfLines={1}>
          {creatorNames ?? ''}
        </Text>
      </View>

      <Pressable
        accessibilityRole='button'
        onPress={onPressPlay}
        disabled={isLoading}
        style={({ pressed }) => ({
          height: FEATURED_CARD_BUTTON_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          backgroundColor: colors.accent,
          opacity: pressed ? 0.85 : 1
        })}>
        {isLoading ? (
          <>
            <ActivityIndicator size='small' color={colors.surface} />
            <Text
              style={{
                color: colors.surface,
                fontFamily: fonts.monoSemiBold,
                fontSize: 15,
                letterSpacing: 0.5
              }}>
              Loading
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: colors.surface, fontSize: 14 }}>{isPlaying ? '❚❚' : '▷'}</Text>
            <Text
              style={{
                color: colors.surface,
                fontFamily: fonts.monoSemiBold,
                fontSize: 15,
                letterSpacing: 0.5
              }}>
              {isPlaying ? 'Pause' : 'Resume'}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  )
}
