import { Option, Schema } from 'effect'
import type { PageServerLoad } from './$types'
import { EmailPreferences } from '@/lib/account/email-preferences'
import { apiRequest } from '@/lib/server/api/api-gateway'
import { requireDashboardAccess } from '@/lib/server/dashboard/guards'

export const load: PageServerLoad = async (event) => {
  const { principal } = requireDashboardAccess(event, 'member')
  const response = await apiRequest(event, '/api/user/email-preferences').catch(() => null)
  const input: unknown = response?.ok ? await response.json().catch(() => null) : null
  const preferences = Option.getOrNull(Schema.decodeUnknownOption(EmailPreferences)(input))
  return {
    principal,
    preferences,
    failure: preferences ? null : 'Could not load email preferences.'
  }
}
