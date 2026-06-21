export type AudioContentType = 'mix' | 'track' | 'misc'

export function audioListQueryKey(
  type: AudioContentType,
  tag: string | undefined,
  limit: number
): ['audio', AudioContentType, string | null, number] {
  return ['audio', type, tag ?? null, limit]
}

export function audioTagsQueryKey(type: AudioContentType): ['audio-tags', AudioContentType] {
  return ['audio-tags', type]
}

export function audioSlugQueryKey(
  type: AudioContentType,
  slug: string
): ['audio', AudioContentType, string] {
  return ['audio', type, slug]
}

export function favoritesQueryKey(): ['favorites'] {
  return ['favorites']
}

export function userSubscriptionsQueryKey(): ['user-subscriptions'] {
  return ['user-subscriptions']
}
