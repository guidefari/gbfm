import { useQuery } from '@tanstack/react-query'
import { apiUrl, fetcher } from '@/lib/http'

export function useContentEdit<T>(editSlug: string | undefined) {
  const isEditMode = Boolean(editSlug)
  return {
    isEditMode,
    ...useQuery({
      queryKey: ['post', editSlug],
      queryFn: () => fetcher<T>(apiUrl(`/content/posts/${editSlug}/edit`)),
      enabled: isEditMode
    })
  }
}
