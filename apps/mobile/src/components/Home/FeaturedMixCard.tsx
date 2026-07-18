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
      <View
        style={{
          aspectRatio: 1,
          backgroundColor: colors.surface,
          borderWidth: 2,
          borderColor: colors.muted,
          borderRadius: 4,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16
        }}>
        <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 14 }}>
          couldn't load the featured mix
        </Text>
        {onRetry ? (
          <Pressable
            accessibilityRole='button'
            onPress={onRetry}
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
        ) : null}
      </View>
    )
  }

  const creatorNames = mix.creators?.map((creator) => creator.name).join(', ')

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: colors.accent,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: colors.surface
      }}>
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

      <View style={{ padding: 16, gap: 4 }}>
        <Text
          style={{
            color: '#FFFFFF',
            fontFamily: fonts.monoSemiBold,
            fontSize: 20,
            textDecorationLine: 'underline',
            textDecorationColor: colors.accent
          }}
          numberOfLines={1}>
          {mix.title}
        </Text>
        {creatorNames ? (
          <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 14 }}>
            {creatorNames}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole='button'
        onPress={onPressPlay}
        disabled={isLoading}
        style={({ pressed }) => ({
          minHeight: 56,
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
