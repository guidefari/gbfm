import type { AudioResponse } from '@gbfm/api/audio'
import { brand, typography } from '@gbfm/theme'
import { LinearGradient } from 'expo-linear-gradient'
import { Image, Text, View } from 'react-native'

const colors = {
  accent: brand['pastel-green-1'],
  muted: brand['pastel-green-2'],
  text: brand.defaultText,
  surface: brand.darkerBg
}

export function FeaturedMixCard({ mix }: { mix: typeof AudioResponse.Type | null }) {
  if (!mix) {
    return (
      <View
        style={{
          aspectRatio: 4 / 5,
          backgroundColor: colors.surface,
          borderWidth: 2,
          borderColor: colors.muted,
          borderRadius: 4
        }}
      />
    )
  }

  const creatorNames = mix.creators?.map((creator) => creator.name).join(', ')
  const episodeTag =
    mix.episodeNumber && !mix.title.includes(String(mix.episodeNumber))
      ? `gb#${mix.episodeNumber}`
      : null

  return (
    <View
      style={{
        aspectRatio: 4 / 5,
        borderWidth: 2,
        borderColor: colors.accent,
        borderRadius: 4,
        overflow: 'hidden'
      }}>
      {mix.thumbnailUrl ? (
        <Image
          source={{ uri: mix.thumbnailUrl }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          resizeMode='cover'
        />
      ) : null}

      <LinearGradient
        pointerEvents='none'
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.85]}
        style={{ position: 'absolute', inset: 0 }}
      />

      <View
        style={{ position: 'absolute', inset: 0, padding: 16, justifyContent: 'space-between' }}>
        <Text
          style={{
            alignSelf: 'flex-start',
            backgroundColor: colors.accent,
            color: colors.surface,
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 2,
            textTransform: 'uppercase',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 2
          }}>
          Now playing
        </Text>

        <View style={{ gap: 6 }}>
          {episodeTag ? (
            <Text
              style={{
                color: colors.accent,
                fontFamily: typography.fontJetbrains,
                fontSize: 13,
                letterSpacing: 1
              }}>
              {episodeTag}
            </Text>
          ) : null}
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: typography.fontSansAlt,
              fontSize: 28,
              lineHeight: 30
            }}
            numberOfLines={2}>
            {mix.title}
          </Text>
          {creatorNames ? (
            <Text
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 13,
                fontWeight: '600',
                letterSpacing: 0.5
              }}>
              {creatorNames}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}
