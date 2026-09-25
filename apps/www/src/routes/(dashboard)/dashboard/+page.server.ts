import { GetFavoritesResponse } from '@gbfm/api/favorites'
import { GetMusicRemindersResponse } from '@gbfm/api/music-reminders'
import { Option, Schema } from 'effect'
import type { PageServerLoad } from './$types'
import { apiRequest } from '@/lib/server/api/api-gateway'
import { requireDashboardAccess } from '@/lib/server/dashboard/guards'

export const load: PageServerLoad = async (event) => {
  const { principal } = requireDashboardAccess(event, 'member')
  const [favoritesResponse, remindersResponse] = await Promise.all([
    apiRequest(event, '/api/favorites?limit=6').catch(() => null),
    apiRequest(event, '/api/music-reminders').catch(() => null)
  ])
  const favoritesInput: unknown = favoritesResponse?.ok
    ? await favoritesResponse.json().catch(() => null)
    : null
  const remindersInput: unknown = remindersResponse?.ok
    ? await remindersResponse.json().catch(() => null)
    : null
  const favorites = Option.getOrNull(
    Schema.decodeUnknownOption(GetFavoritesResponse)(favoritesInput)
  )
  const reminders = Option.getOrNull(
    Schema.decodeUnknownOption(GetMusicRemindersResponse)(remindersInput)
  )

  return {
    principal,
    favorites: favorites?.favorites ?? [],
    favoritesFailure: favorites ? null : 'Could not load favorites.',
    reminders: reminders?.reminders ?? [],
    remindersFailure: reminders ? null : 'Could not load reminders.'
  }
}
