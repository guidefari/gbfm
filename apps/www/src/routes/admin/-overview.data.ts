import type { AdminOverview } from '@gbfm/vps/schemas'
import { useQuery } from '@tanstack/react-query'
import { apiUrl, fetcher } from '@/lib/http'

export type { AdminOverviewContentBreakdown } from '@gbfm/vps/schemas'

export function useAdminOverview() {
  return useQuery<AdminOverview, Error>({
    queryKey: ['admin', 'overview'],
    queryFn: () => fetcher<AdminOverview>(apiUrl('/admin/overview'))
  })
}
