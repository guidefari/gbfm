import type { QueueTrackType } from '@gbfm/player'
import { Effect } from 'effect'
import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'

import { FavoriteButton } from '@/components/NowPlaying/FavoriteButton'
import { FavoriteToast } from '@/components/NowPlaying/FavoriteToast'
import { FavoriteStatus, TrackFavorite } from '@/favorites/favoriteState'
import { useTrackFavorite } from '@/favorites/useTrackFavorite'
import { useClearAuth } from '@/store/auth'
import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'

const needsSignIn = (favorite: TrackFavorite) =>
  TrackFavorite.$is('SignedOut')(favorite) || FavoriteStatus.$is('SessionExpired')(favorite.status)

export function NowPlayingTitle({ track }: { readonly track: QueueTrackType }) {
  const colors = useThemeColors()
  const router = useRouter()
  const clearAuth = useClearAuth()
  const { favorite, press, notice } = useTrackFavorite(track)
  const creators = track.creators ?? []

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
      <FavoriteToast notice={notice} />
    </View>
  )
}
