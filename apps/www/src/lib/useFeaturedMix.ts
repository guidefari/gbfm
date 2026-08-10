import type { SelectAudio } from '@gbfm/server/schemas'
import { useQuery } from '@tanstack/react-query'
import { apiUrl, fetcher, type PaginatedResponse } from './http'

export function useFeaturedMix() {
  const { data, error, isPending } = useQuery<SelectAudio, Error>({
    queryKey: ['featured-mix'],
    queryFn: async () => {
      const response = await fetcher<PaginatedResponse<SelectAudio>>(
        apiUrl('/content/audio/mix?limit=1&offset=0')
      )
      return response.data[0]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  })

  return {
    data,
    error,
    isPending
  }
}
