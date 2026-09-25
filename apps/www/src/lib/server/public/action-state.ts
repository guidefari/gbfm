import { GetFavoritesResponse } from '@gbfm/api/favorites'
import { GetUserSubscriptionsResponse } from '@gbfm/api/user'
import type { RequestEvent } from '@sveltejs/kit'
import { Option, Predicate, Schema } from 'effect'

import { apiRequest } from '@/lib/server/api/api-gateway'

type PublicActionKind = 'audio' | 'show'

/** Resolves authenticated favorite or subscription state during server rendering. */
export async function loadPublicActionState(
  event: Pick<RequestEvent, 'platform' | 'request' | 'locals'>,
  kind: PublicActionKind,
  id: string,
): Promise<boolean> {
  if (!id || Predicate.isTagged(event.locals.principal, 'Anonymous')) return false

  try {
    const endpoint =
      kind === 'show'
        ? '/api/user/subscriptions?limit=100&offset=0'
        : '/api/favorites?limit=100&offset=0'

    const response = await apiRequest(event, endpoint)

    if (!response.ok) return false

    const input: unknown = await response.json()

    if (kind === 'show') {
      const subscriptions = Option.getOrNull(
        Schema.decodeUnknownOption(GetUserSubscriptionsResponse)(input),
      )

      return subscriptions?.data.some((subscription) => subscription.showId === id) ?? false
    }

    const favorites = Option.getOrNull(Schema.decodeUnknownOption(GetFavoritesResponse)(input))

    return favorites?.favorites.some((favorite) => favorite.audioId === id) ?? false
  } catch {
    return false
  }
}
