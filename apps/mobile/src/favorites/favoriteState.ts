import { Data, Predicate } from 'effect'

import type { FavoriteError } from '@/api/favorites'

export type FavoriteStatus =
  | { readonly _tag: 'Loading' }
  | { readonly _tag: 'Ready'; readonly favorite: boolean }
  | { readonly _tag: 'Saving'; readonly favorite: boolean; readonly target: boolean }
  | { readonly _tag: 'SaveFailed'; readonly favorite: boolean }
  | { readonly _tag: 'LoadFailed' }
  | { readonly _tag: 'Unavailable' }
  | { readonly _tag: 'SessionExpired' }

export const FavoriteStatus = Data.taggedEnum<FavoriteStatus>()

export type FavoriteEvent =
  | { readonly _tag: 'LoadStarted'; readonly key: string }
  | { readonly _tag: 'Loaded'; readonly key: string; readonly favorite: boolean }
  | { readonly _tag: 'SaveStarted'; readonly key: string }
  | { readonly _tag: 'Saved'; readonly key: string; readonly favorite: boolean }
  | { readonly _tag: 'Failed'; readonly key: string; readonly error: FavoriteError }

export const FavoriteEvent = Data.taggedEnum<FavoriteEvent>()

export type FavoriteState = { readonly key: string; readonly status: FavoriteStatus }

export const favoriteKey = (accountId: string, trackId: string) => `${accountId}\u0000${trackId}`

const loading = FavoriteStatus.Loading()

export const initialFavoriteState = (key: string): FavoriteState => ({ key, status: loading })

export const statusFor = (state: FavoriteState, key: string): FavoriteStatus =>
  state.key === key ? state.status : loading

type SavableStatus = Extract<FavoriteStatus, { readonly _tag: 'Ready' | 'SaveFailed' }>

export const canSave = (status: FavoriteStatus): status is SavableStatus =>
  Predicate.isTagged(status, 'Ready') || Predicate.isTagged(status, 'SaveFailed')

const isPending = (status: FavoriteStatus) =>
  Predicate.isTagged(status, 'Loading') || Predicate.isTagged(status, 'Saving')

const failedStatus = (status: FavoriteStatus, error: FavoriteError): FavoriteStatus => {
  if (Predicate.isTagged(error, 'FavoriteSessionExpired')) return FavoriteStatus.SessionExpired()

  if (Predicate.isTagged(error, 'FavoriteTrackUnavailable')) return FavoriteStatus.Unavailable()

  return FavoriteStatus.$is('Saving')(status)
    ? FavoriteStatus.SaveFailed({ favorite: status.favorite })
    : FavoriteStatus.LoadFailed()
}

const withStatus = (state: FavoriteState, status: FavoriteStatus): FavoriteState => ({
  key: state.key,
  status,
})

export const reduceFavorite = (state: FavoriteState, event: FavoriteEvent): FavoriteState => {
  if (FavoriteEvent.$is('LoadStarted')(event)) return initialFavoriteState(event.key)

  if (event.key !== state.key) return state

  const { status } = state

  return FavoriteEvent.$match(event, {
    LoadStarted: () => state,
    Loaded: ({ favorite }) =>
      FavoriteStatus.$is('Loading')(status)
        ? withStatus(state, FavoriteStatus.Ready({ favorite }))
        : state,
    SaveStarted: () =>
      canSave(status)
        ? withStatus(
            state,
            FavoriteStatus.Saving({ favorite: status.favorite, target: !status.favorite }),
          )
        : state,
    Saved: ({ favorite }) =>
      FavoriteStatus.$is('Saving')(status)
        ? withStatus(state, FavoriteStatus.Ready({ favorite }))
        : state,
    Failed: ({ error }) =>
      isPending(status) ? withStatus(state, failedStatus(status, error)) : state,
  })
}

export type TrackFavorite =
  | { readonly _tag: 'SignedOut' }
  | { readonly _tag: 'SignedIn'; readonly status: FavoriteStatus }

export const TrackFavorite = Data.taggedEnum<TrackFavorite>()

export const trackFavoriteFor = (status: FavoriteStatus | null): TrackFavorite =>
  status ? TrackFavorite.SignedIn({ status }) : TrackFavorite.SignedOut()
