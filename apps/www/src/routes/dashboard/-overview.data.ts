import type { AdminOverview } from '@gbfm/vps/schemas'
import { Effect } from 'effect'
import { useQuery } from '@tanstack/react-query'
import { getApiClient } from '@/lib/api-client'
import { captureException } from '@/services/analytics'

export type { AdminOverviewContentBreakdown } from '@gbfm/vps/schemas'

export function useAdminOverview() {
  return useQuery<AdminOverview, Error>({
    queryKey: ['admin', 'overview'],
    queryFn: async () => {
      const client = await getApiClient()
      const overview = await Effect.runPromise(
        client.admin
          .getAdminOverview({})
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'admin.getAdminOverview' })
            )
          )
      )
      return {
        ...overview,
        publishing: {
          ...overview.publishing,
          recentContent: [...overview.publishing.recentContent],
          topMixes: overview.publishing.topMixes.map((mix) => ({
            ...mix,
            creators: [...mix.creators]
          }))
        },
        community: {
          ...overview.community,
          recentUsers: [...overview.community.recentUsers],
          recentSubscribers: [...overview.community.recentSubscribers]
        },
        operations: {
          ...overview.operations,
          emails: {
            ...overview.operations.emails,
            recentFailures: [...overview.operations.emails.recentFailures]
          }
        }
      }
    }
  })
}
