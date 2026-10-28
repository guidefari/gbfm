import type { QueueTrackType } from '@gbfm/player'
import { Effect } from 'effect'
import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'

import { FavoriteButton } from '@/components/NowPlaying/FavoriteButton'
import { FavoriteStatus, TrackFavorite } from '@/favorites/favoriteState'
import { useTrackFavorite } from '@/favorites/useTrackFavorite'
import { useClearAuth } from '@/store/auth'
import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'

type FavoriteMessage = { readonly text: string; readonly isError: boolean }

const messageFor = (favorite: TrackFavorite): FavoriteMessage | null =>
  TrackFavorite.$match(favorite, {
    SignedOut: () => null,
    SignedIn: ({ status }) =>
      FavoriteStatus.$match(status, {
        Loading: () => null,
        Ready: () => null,
        Saving: () => null,
        SaveFailed: () => ({
          text: 'Couldn’t update favorites. Tap the heart to try again.',
          isError: true,
        }),
        LoadFailed: () => ({
          text: 'Couldn’t load your favorite. Tap the heart to try again.',
          isError: true,
        }),
        SessionExpired: () => ({
          text: 'Your session expired. Tap the heart to sign in again.',
          isError: false,
        }),
        Unavailable: () => ({ text: 'Favorites aren’t available for this track.', isError: false }),
      }),
  })

const needsSignIn = (favorite: TrackFavorite) =>
  TrackFavorite.$is('SignedOut')(favorite) || FavoriteStatus.$is('SessionExpired')(favorite.status)

export function NowPlayingTitle({ track }: { readonly track: QueueTrackType }) {
  const colors = useThemeColors()
  const router = useRouter()
  const clearAuth = useClearAuth()
  const { favorite, press } = useTrackFavorite(track)
  const creators = track.creators ?? []
  const message = messageFor(favorite)

  const handlePress = () => {
    if (!needsSignIn(favorite)) return press()

    if (TrackFavorite.$is('SignedIn')(favorite)) {
      void Effect.runPromise(clearAuth().pipe(Effect.ignore))
    }

    router.dismissTo('/profile')
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 6, paddingTop: 9 }}>
          <Text
            style={{
              color: colors.strong,
              fontFamily: fonts.monoSemiBold,
              fontSize: 20,
              lineHeight: 26,
            }}
            numberOfLines={2}>
            {track.title}
          </Text>
          {creators.length ? (
            <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 13 }}>
              {creators.map((creator) => creator.name).join(', ')}
            </Text>
          ) : null}
        </View>
        <View style={{ marginRight: -10 }}>
          <FavoriteButton favorite={favorite} onPress={handlePress} />
        </View>
      </View>
      {message ? (
        <Text
          accessibilityLiveRegion='polite'
          style={{
            color: message.isError ? colors.error : colors.muted,
            fontFamily: fonts.mono,
            fontSize: 12,
          }}>
          {message.text}
        </Text>
      ) : null}
    </View>
  )
}
