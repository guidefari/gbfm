import { SymbolView } from 'expo-symbols'
import { Pressable } from 'react-native'

import { FavoriteStatus, TrackFavorite } from '@/favorites/favoriteState'
import { useThemeColors, withAlpha } from '@/theme/colors'

const symbols = {
  heart: { ios: 'heart', android: 'favorite_border', web: 'favorite_border' },
  heartFill: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
} as const

type ButtonPresentation = {
  readonly label: string
  readonly filled: boolean
  readonly busy: boolean
  readonly disabled: boolean
}

const idle = { busy: false, disabled: false }

const presentationFor = (favorite: TrackFavorite): ButtonPresentation =>
  TrackFavorite.$match(favorite, {
    SignedOut: () => ({ ...idle, label: 'Sign in to add to favorites', filled: false }),
    SignedIn: ({ status }) =>
      FavoriteStatus.$match(status, {
        Loading: () => ({ label: 'Loading favorite', filled: false, busy: true, disabled: true }),
        Ready: ({ favorite: active }) => ({
          ...idle,
          label: active ? 'Remove from favorites' : 'Add to favorites',
          filled: active,
        }),
        Saving: ({ favorite: active, target }) => ({
          label: target ? 'Adding to favorites' : 'Removing from favorites',
          filled: active,
          busy: true,
          disabled: true,
        }),
        SaveFailed: ({ favorite: active }) => ({
          ...idle,
          label: active ? 'Retry removing from favorites' : 'Retry adding to favorites',
          filled: active,
        }),
        LoadFailed: () => ({ ...idle, label: 'Retry loading favorite', filled: false }),
        Unavailable: () => ({
          label: 'Favorites unavailable',
          filled: false,
          busy: false,
          disabled: true,
        }),
        SessionExpired: () => ({ ...idle, label: 'Sign in again to use favorites', filled: false }),
      }),
  })

export function FavoriteButton({
  favorite,
  onPress,
}: {
  readonly favorite: TrackFavorite
  readonly onPress: () => void
}) {
  const colors = useThemeColors()
  const { label, filled, busy, disabled } = presentationFor(favorite)

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityState={{ selected: filled, busy, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: busy ? 0.5 : disabled ? 0.35 : pressed ? 0.6 : 1,
      })}>
      <SymbolView
        name={filled ? symbols.heartFill : symbols.heart}
        size={24}
        tintColor={filled ? colors.accent : withAlpha(colors.muted, 0.9)}
      />
    </Pressable>
  )
}
