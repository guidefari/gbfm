import { GetMusicRemindersResponse } from '@gbfm/api/music-reminders'
import { Option, Schema } from 'effect'
import type { PageServerLoad } from './$types'
import { apiRequest } from '@/lib/server/api/api-gateway'

export const load: PageServerLoad = async (event) => {
  const response = await apiRequest(event, '/api/music-reminders').catch(() => null)
  const input: unknown = response?.ok ? await response.json().catch(() => null) : null
  const result = Option.getOrNull(
    Schema.decodeUnknownOption(GetMusicRemindersResponse)(input)
  )
  return {
    reminders: result?.reminders ?? [],
    failure: result ? null : 'Could not load reminders.'
  }
}
