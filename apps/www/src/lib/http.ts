import type {
  SelectAudio,
  SelectLabel,
  SelectMdxCompiledAudio,
  SelectMdxCompiledLabel,
  SelectMdxCompiledRelease,
  SelectMdxCompiledShow,
  SelectRelease,
  SelectShow,
  SelectShowSubscription
} from '@gbfm/vps/schemas'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import type { User } from '@/store/auth'
import { useAuthStore } from '@/store/auth'
import type {
  AlbumApiResponse,
  PlaylistApiResponse,
  TrackAPIResponse
} from '@/types'

export const VPS_BASE_URL = import.meta.env.VITE_VPS_BASE_URL

// Pagination types
export type PaginationMetadata = {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export type PaginatedResponse<T> = {
  data: T[]
  pagination: PaginationMetadata
}

export async function fetcher<T>(input: RequestInfo, init: RequestInit = {}) {
  try {
    const isFormData = init.body instanceof FormData
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers
    }

    const res = await fetch(input, {
      ...init,
      headers,
      credentials: 'include'
    })

    if (res.status === 401) {
      // const { clearAuth } = useAuthStore.getState()
      // clearAuth()
      window.location.href = '/auth/sign-in'
    }

    return res.json() as Promise<T>
  } catch (error) {
    console.error(error)
    throw error
  }
}

export function useAudioByType(type: 'mix' | 'track' | 'misc', tag?: string) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending
  } = useInfiniteQuery<PaginatedResponse<SelectAudio>, Error>({
    queryKey: ['audio', type, tag].filter(Boolean),
    queryFn: async ({ pageParam = 0 }) => {
      const url = new URL(`${VPS_BASE_URL}/content/audio/${type}`)
      url.searchParams.set('limit', '20')
      url.searchParams.set('offset', String(pageParam))
      if (tag) url.searchParams.set('tag', tag)
      return fetcher<PaginatedResponse<SelectAudio>>(url.toString())
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined
  })

  return {
    data: data?.pages.flatMap((page) => page.data) ?? [],
    error,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  }
}

export function useAudioBySlug(type: 'mix' | 'track' | 'misc', slug: string) {
  const { data, error, isPending } = useQuery<SelectMdxCompiledAudio, Error>({
    queryKey: ['audio', type, slug],
    queryFn: async () =>
      fetcher(`${VPS_BASE_URL}/content/audio/${type}/${slug}`),
    enabled: Boolean(slug) // Only run query if slug is provided
  })

  return {
    data,
    error,
    isPending
  }
}

type SpotifyContentType = 'album' | 'track' | 'playlist'

type SpotifyProxyInput<T extends SpotifyContentType> = {
  id: string
  spotifyContentType: T
}

type SpotifyProxyResponseType<T> = T extends 'album'
  ? AlbumApiResponse
  : T extends 'track'
    ? TrackAPIResponse
    : T extends 'playlist'
      ? PlaylistApiResponse
      : never

export function useSpotifyProxy<T extends SpotifyContentType>({
  id,
  spotifyContentType
}: SpotifyProxyInput<T>) {
  const { data, error, isLoading } = useQuery<
    SpotifyProxyResponseType<typeof spotifyContentType>
  >({
    queryKey: ['spotify/proxy', spotifyContentType, id],

    queryFn: async () =>
      fetcher(`${VPS_BASE_URL}/spotify/${spotifyContentType}`, {
        method: 'POST',
        body: JSON.stringify({ id })
      }),
    staleTime: 15 * 60 * 1000
  })
  return {
    data: data,
    isLoading,
    error
  }
}

export type EnrichedTrack = {
  title: string
  artist: string
  url: string
  platform: 'spotify' | 'youtube' | 'apple_music' | 'other'
  thumbnailUrl?: string
  duration?: number
  album?: string
}

export function useEnrichTrackFromUrl(url: string) {
  const { data, error, isLoading } = useQuery<EnrichedTrack>({
    queryKey: ['spotify/enrich', url],
    queryFn: async () =>
      fetcher(`${VPS_BASE_URL}/spotify/enrich`, {
        method: 'POST',
        body: JSON.stringify({ url })
      }),
    enabled: !!url && url.length > 10, // Only run if URL is reasonably long
    staleTime: 15 * 60 * 1000
  })
  return {
    data,
    isLoading,
    error
  }
}

export function useUserLOL() {
  const { data, error, isPending } = useQuery<User, Error>({
    queryKey: ['user'],
    queryFn: async () => fetcher(`${VPS_BASE_URL}/auth/profile`)
  })

  return {
    data,
    error,
    isPending
  }
}

export function useUpdateProfile() {
  const { mutateAsync: updateProfile, isPending } = useMutation<
    User,
    Error,
    FormData | User
  >({
    mutationFn: async (data) =>
      fetcher(`${VPS_BASE_URL}/auth/profile`, {
        method: 'PATCH',
        body: data instanceof FormData ? data : JSON.stringify(data)
      })
  })

  return {
    updateProfile,
    isPending
  }
}

export type EmailPreferences = {
  id: string
  userId: string
  mixReleaseEnabled: boolean
  promotionalEnabled: boolean
  systemEnabled: boolean
  globalUnsubscribe: boolean
  unsubscribeToken: string | null
  createdAt: Date
  updatedAt: Date
}

export function useEmailPreferences() {
  const { data, error, isPending } = useQuery<EmailPreferences, Error>({
    queryKey: ['email-preferences'],
    queryFn: async () => fetcher(`${VPS_BASE_URL}/auth/email-preferences`)
  })

  return {
    data,
    error,
    isPending
  }
}

export function useUpdateEmailPreferences() {
  const { mutateAsync: updateEmailPreferences, isPending } = useMutation<
    EmailPreferences,
    Error,
    Partial<EmailPreferences>
  >({
    mutationFn: async (preferences) =>
      fetcher(`${VPS_BASE_URL}/auth/email-preferences`, {
        method: 'PATCH',
        body: JSON.stringify(preferences)
      })
  })

  return {
    updateEmailPreferences,
    isPending
  }
}

export function useAllLabels() {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending
  } = useInfiniteQuery<PaginatedResponse<SelectLabel>, Error>({
    queryKey: ['labels'],
    queryFn: async ({ pageParam = 0 }) =>
      fetcher<PaginatedResponse<SelectLabel>>(
        `${VPS_BASE_URL}/content/labels?limit=20&offset=${pageParam}`
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined
  })

  return {
    data: data?.pages.flatMap((page) => page.data) ?? [],
    error,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  }
}

export function useLabelBySlug(slug: string) {
  const { data, error, isPending } = useQuery<SelectMdxCompiledLabel, Error>({
    queryKey: ['label', slug],
    queryFn: async () => fetcher(`${VPS_BASE_URL}/content/labels/${slug}`),
    enabled: Boolean(slug)
  })

  return {
    data,
    error,
    isPending
  }
}

export function useReleasesByLabel(labelSlug: string) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending
  } = useInfiniteQuery<PaginatedResponse<SelectRelease>, Error>({
    queryKey: ['releases', 'label', labelSlug],
    queryFn: async ({ pageParam = 0 }) =>
      fetcher<PaginatedResponse<SelectRelease>>(
        `${VPS_BASE_URL}/content/labels/${labelSlug}/releases?limit=20&offset=${pageParam}`
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
    enabled: Boolean(labelSlug)
  })

  return {
    data: data?.pages.flatMap((page) => page.data) ?? [],
    error,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  }
}

export function useReleaseBySlug(slug: string) {
  const { data, error, isPending } = useQuery<SelectMdxCompiledRelease, Error>({
    queryKey: ['release', slug],
    queryFn: async () => fetcher(`${VPS_BASE_URL}/content/releases/${slug}`),
    enabled: Boolean(slug)
  })

  return {
    data,
    error,
    isPending
  }
}

export type FavoriteAudio = {
  id: string
  title: string
  slug: string
  thumbnailUrl: string | null
  type: 'mix' | 'track' | 'misc'
  url: string
}

export type Favorite = {
  id: string
  userId: string
  audioId: string
  createdAt: string
  audio: FavoriteAudio
}

export type FavoritesResponse = {
  success: boolean
  favorites: Favorite[]
  total: number
}

export function useFavorites() {
  const { isAuthenticated } = useAuthStore()
  const { data, error, isPending, refetch } = useQuery<
    FavoritesResponse,
    Error
  >({
    queryKey: ['favorites'],
    queryFn: async () => fetcher(`${VPS_BASE_URL}/favorites`),
    enabled: isAuthenticated
  })

  return {
    data: data?.favorites ?? [],
    total: data?.total ?? 0,
    error,
    isPending,
    refetch
  }
}

export function useAddFavorite() {
  const queryClient = useQueryClient()
  const { mutateAsync: addFavorite, isPending } = useMutation<
    { success: boolean; message: string },
    Error,
    { audioId: string }
  >({
    mutationFn: async ({ audioId }) =>
      fetcher(`${VPS_BASE_URL}/favorites`, {
        method: 'POST',
        body: JSON.stringify({ audioId })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    }
  })

  return {
    addFavorite,
    isPending
  }
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient()
  const { mutateAsync: removeFavorite, isPending } = useMutation<
    { success: boolean; message: string },
    Error,
    { audioId: string }
  >({
    mutationFn: async ({ audioId }) =>
      fetcher(`${VPS_BASE_URL}/favorites/${audioId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    }
  })

  return {
    removeFavorite,
    isPending
  }
}

export type ShowWithHosts = SelectShow & {
  hosts: Array<{ id: string; name: string }>
}

export function useAllShows() {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending
  } = useInfiniteQuery<PaginatedResponse<ShowWithHosts>, Error>({
    queryKey: ['shows'],
    queryFn: async ({ pageParam = 0 }) =>
      fetcher<PaginatedResponse<ShowWithHosts>>(
        `${VPS_BASE_URL}/shows?limit=20&offset=${pageParam}`
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined
  })

  return {
    data: data?.pages.flatMap((page) => page.data) ?? [],
    error,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  }
}

export function useShowBySlug(slug: string) {
  const { data, error, isPending } = useQuery<SelectMdxCompiledShow, Error>({
    queryKey: ['show', slug],
    queryFn: async () => fetcher(`${VPS_BASE_URL}/shows/${slug}`),
    enabled: Boolean(slug)
  })

  return {
    data,
    error,
    isPending
  }
}

export function useShowEpisodes(slug: string) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending
  } = useInfiniteQuery<PaginatedResponse<SelectAudio>, Error>({
    queryKey: ['show-episodes', slug],
    queryFn: async ({ pageParam = 0 }) =>
      fetcher<PaginatedResponse<SelectAudio>>(
        `${VPS_BASE_URL}/shows/${slug}/episodes?limit=20&offset=${pageParam}`
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
    enabled: Boolean(slug)
  })

  return {
    data: data?.pages.flatMap((page) => page.data) ?? [],
    error,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  }
}

export type SubscriptionWithShow = SelectShowSubscription & {
  show: SelectShow
}

export function useUserSubscriptions() {
  const { isAuthenticated } = useAuthStore()
  const { data, error, isPending } = useQuery<
    PaginatedResponse<SubscriptionWithShow>,
    Error
  >({
    queryKey: ['user-subscriptions'],
    queryFn: async () =>
      fetcher<PaginatedResponse<SubscriptionWithShow>>(
        `${VPS_BASE_URL}/user/subscriptions`
      ),
    enabled: isAuthenticated
  })

  return {
    data: data?.data ?? [],
    error,
    isPending
  }
}

export function useSubscribeToShow() {
  const queryClient = useQueryClient()
  const { mutateAsync: subscribe, isPending } = useMutation<
    SelectShowSubscription,
    Error,
    { showId: string }
  >({
    mutationFn: async ({ showId }) =>
      fetcher(`${VPS_BASE_URL}/shows/${showId}/subscribe`, {
        method: 'POST'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] })
    }
  })

  return {
    subscribe,
    isPending
  }
}

export function useUnsubscribeFromShow() {
  const queryClient = useQueryClient()
  const { mutateAsync: unsubscribe, isPending } = useMutation<
    void,
    Error,
    { showId: string }
  >({
    mutationFn: async ({ showId }) =>
      fetcher(`${VPS_BASE_URL}/shows/${showId}/unsubscribe`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] })
    }
  })

  return {
    unsubscribe,
    isPending
  }
}
