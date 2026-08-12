import {
  hasActiveSpotifyDeviceEffect,
  playSpotifyEntityEffect,
  queueSpotifyEntityEffect,
  SPOTIFY_ENTITY_KIND,
  spotifyEntityFromUrl,
  spotifyErrorMessage,
  type SpotifyEntityRef,
  type SpotifyRequestError
} from '@gbfm/spotify'
import * as Effect from 'effect/Effect'
import { Linking } from 'react-native'
import { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { SPOTIFY_GREEN, SpotifyIcon } from './SpotifyIcon'
import { runSpotifyEffect } from './runtime'
import { useSpotifyConnection } from './connection'
import { useThemeColors } from '@/theme/colors'

type Props = {
  url: string
  onNotice: (message: string) => void
}

const entityNoun = {
  [SPOTIFY_ENTITY_KIND.TRACK]: 'Track',
  [SPOTIFY_ENTITY_KIND.ALBUM]: 'Album',
  [SPOTIFY_ENTITY_KIND.PLAYLIST]: 'Playlist'
} satisfies Record<SpotifyEntityRef['kind'], string>

export function SpotifyEntityActions({ url, onNotice }: Props) {
  const session = useSpotifyConnection((state) => state.session)
  const [pending, setPending] = useState<'play' | 'queue' | null>(null)
  const colors = useThemeColors()

  const entity = spotifyEntityFromUrl(url)
  if (!entity || !session) return null

  const openInSpotify = () => {
    void Linking.openURL(url)
  }

  const run = async (action: 'play' | 'queue') => {
    setPending(action)

    await runSpotifyEffect(
      hasActiveSpotifyDeviceEffect().pipe(
        Effect.flatMap((hasDevice) => {
          if (!hasDevice) {
            return Effect.sync(() => {
              onNotice('No active Spotify device, opening in Spotify instead')
              openInSpotify()
            })
          }

          if (action === 'play') {
            return playSpotifyEntityEffect(entity).pipe(
              Effect.map(() => {
                onNotice(`Playing ${entityNoun[entity.kind].toLowerCase()}`)
              })
            )
          }

          return queueSpotifyEntityEffect(entity).pipe(
            Effect.map((count) => {
              onNotice(count === 1 ? 'Added to queue' : `Added ${count} tracks to queue`)
            })
          )
        }),
        Effect.catch((error: SpotifyRequestError) =>
          Effect.sync(() => {
            onNotice(spotifyErrorMessage(error))
            openInSpotify()
          })
        )
      )
    ).finally(() => setPending(null))
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: `${colors.muted}40`,
        overflow: 'hidden'
      }}>
      <TouchableOpacity
        accessibilityRole='button'
        accessibilityLabel={`Play ${entityNoun[entity.kind].toLowerCase()} on Spotify`}
        disabled={pending !== null}
        onPress={() => void run('play')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: `${SPOTIFY_GREEN}1a`,
          opacity: pending !== null ? 0.6 : 1
        }}>
        <SpotifyIcon size={12} />
        <Text style={{ color: colors.strong, fontSize: 12, fontWeight: '600' }}>
          {pending === 'play' ? 'Playing...' : 'Play'}
        </Text>
      </TouchableOpacity>
      <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: `${colors.muted}40` }} />
      <TouchableOpacity
        accessibilityRole='button'
        accessibilityLabel={`Add ${entityNoun[entity.kind].toLowerCase()} to Spotify queue`}
        disabled={pending !== null}
        onPress={() => void run('queue')}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          opacity: pending !== null ? 0.6 : 1
        }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>
          {pending === 'queue' ? 'Queueing...' : 'Queue'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
