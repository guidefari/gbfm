import { UserProfileResponse } from '@gbfm/api/user'
import { Option, Schema } from 'effect'

import { apiRequest } from '@/lib/server/api/api-gateway'
import { requireDashboardAccess } from '@/lib/server/dashboard/guards'

import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
  const { principal } = requireDashboardAccess(event, 'member')
  const response = await apiRequest(event, '/api/user/profile').catch(() => null)
  const input: unknown = response?.ok ? await response.json().catch(() => null) : null
  const profile = Option.getOrNull(Schema.decodeUnknownOption(UserProfileResponse)(input))

  return { principal, profile, failure: profile ? null : 'Could not load profile.' }
}
