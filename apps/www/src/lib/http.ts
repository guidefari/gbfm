import type {
  SelectAudio,
  SelectLabel,
  SelectMdxCompiledAudio,
  SelectMdxCompiledLabel,
  SelectMdxCompiledPost,
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

export type SocialLinkPlatform =
  | 'bandcamp'
  | 'substack'
  | 'soundcloud'
  | 'instagram'
  | 'twitter'
  | 'tiktok'

export type SocialLink = {
  platform: SocialLinkPlatform
  url: string
  position: number
}

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
      window.location.href = '/auth/sign-in'
      throw new Error('Unauthorized')
    }

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`)
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

export function usePosts(type?: 'post' | 'micro', limit = 20) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending
  } = useInfiniteQuery<PaginatedResponse<SelectMdxCompiledPost>, Error>({
    queryKey: ['posts', type, limit].filter(Boolean),
    queryFn: async ({ pageParam = 0 }) => {
      const url = new URL(`${VPS_BASE_URL}/content/posts`)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('offset', String(pageParam))
      if (type) url.searchParams.set('type', type)
      return fetcher<PaginatedResponse<SelectMdxCompiledPost>>(url.toString())
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

export function usePostBySlug(slug: string) {
  const { data, error, isPending } = useQuery<SelectMdxCompiledPost, Error>({
    queryKey: ['post', slug],
    queryFn: async () => fetcher(`${VPS_BASE_URL}/content/posts/${slug}`),
    enabled: Boolean(slug)
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
    queryFn: async () => fetcher(`${VPS_BASE_URL}/user/profile`)
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
      fetcher(`${VPS_BASE_URL}/user/profile`, {
        method: 'PATCH',
        body: data instanceof FormData ? data : JSON.stringify(data)
      })
  })

  return {
    updateProfile,
    isPending
  }
}

export function useAdminUserSocialLinks(userId: string) {
  return useQuery<SocialLink[], Error>({
    queryKey: ['admin', 'user-social-links', userId],
    queryFn: () =>
      fetcher<SocialLink[]>(
        `${VPS_BASE_URL}/user/admin/${userId}/social-links`
      ),
    enabled: Boolean(userId)
  })
}

export function useReplaceAdminUserSocialLinks() {
  const queryClient = useQueryClient()
  return useMutation<
    SocialLink[],
    Error,
    { userId: string; links: SocialLink[] }
  >({
    mutationFn: ({ userId, links }) =>
      fetcher<SocialLink[]>(
        `${VPS_BASE_URL}/user/admin/${userId}/social-links`,
        {
          method: 'PUT',
          body: JSON.stringify(links)
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'user-social-links', variables.userId]
      })
    }
  })
}

export function useUpdateAdminUserBio() {
  return useMutation<
    { bio: string | null },
    Error,
    { userId: string; bio: string }
  >({
    mutationFn: ({ userId, bio }) =>
      fetcher<{ bio: string | null }>(
        `${VPS_BASE_URL}/user/admin/${userId}/bio`,
        {
          method: 'PATCH',
          body: JSON.stringify({ bio })
        }
      )
  })
}

export function useAdminUserBio(userId: string) {
  return useQuery<{ bio: string | null }, Error>({
    queryKey: ['admin', 'user-bio', userId],
    queryFn: () =>
      fetcher<{ bio: string | null }>(
        `${VPS_BASE_URL}/user/admin/${userId}/bio`
      ),
    enabled: Boolean(userId)
  })
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
    queryFn: async () => fetcher(`${VPS_BASE_URL}/user/email-preferences`)
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
      fetcher(`${VPS_BASE_URL}/user/email-preferences`, {
        method: 'PATCH',
        body: JSON.stringify(preferences)
      })
  })

  return {
    updateEmailPreferences,
    isPending
  }
}

export type EmailLogStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'BOUNCED'
  | 'COMPLAINED'
  | 'FAILED'

export type AdminEmailLog = {
  id: string
  userId: string | null
  recipientEmail: string
  recipientName: string | null
  emailType: string
  templateName: string
  subject: string
  status: EmailLogStatus
  sesMessageId: string | null
  metadata: Record<string, unknown> | null
  errorMessage: string | null
  sentAt: string | Date | null
  deliveredAt: string | Date | null
  bouncedAt: string | Date | null
  complainedAt: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
}

export type AdminEmailLogsFilters = {
  limit?: number
  offset?: number
  status?: EmailLogStatus
  recipientEmail?: string
  dateFrom?: string
  dateTo?: string
}

export function useAdminEmailLogs({
  limit = 20,
  offset = 0,
  status,
  recipientEmail,
  dateFrom,
  dateTo
}: AdminEmailLogsFilters) {
  return useQuery<PaginatedResponse<AdminEmailLog>, Error>({
    queryKey: [
      'admin',
      'email-logs',
      limit,
      offset,
      status,
      recipientEmail,
      dateFrom,
      dateTo
    ],
    queryFn: async () => {
      const url = new URL(`${VPS_BASE_URL}/email/logs`)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('offset', String(offset))
      if (status) url.searchParams.set('status', status)
      if (recipientEmail) url.searchParams.set('recipientEmail', recipientEmail)
      if (dateFrom) url.searchParams.set('dateFrom', dateFrom)
      if (dateTo) url.searchParams.set('dateTo', dateTo)

      return fetcher<PaginatedResponse<AdminEmailLog>>(url.toString())
    }
  })
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
  audioId: string | null
  showId: string | null
  createdAt: string
  audio: FavoriteAudio | null
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

export function useAddShowFavorite() {
  const queryClient = useQueryClient()
  const { mutateAsync: addShowFavorite, isPending } = useMutation<
    { success: boolean; message: string },
    Error,
    { showId: string }
  >({
    mutationFn: async ({ showId }) =>
      fetcher(`${VPS_BASE_URL}/favorites`, {
        method: 'POST',
        body: JSON.stringify({ showId })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    }
  })

  return {
    addShowFavorite,
    isPending
  }
}

export function useRemoveShowFavorite() {
  const queryClient = useQueryClient()
  const { mutateAsync: removeShowFavorite, isPending } = useMutation<
    { success: boolean; message: string },
    Error,
    { showId: string }
  >({
    mutationFn: async ({ showId }) =>
      fetcher(`${VPS_BASE_URL}/favorites/show/${showId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    }
  })

  return {
    removeShowFavorite,
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

export type ShowBasicInfo = {
  id: string
  title: string
  slug: string
  thumbnailUrl: string | null
}

export function useShowById(id: string | null | undefined) {
  const { data, error, isPending } = useQuery<ShowBasicInfo, Error>({
    queryKey: ['show-by-id', id],
    queryFn: async () => {
      const shows = await fetcher<PaginatedResponse<ShowWithHosts>>(
        `${VPS_BASE_URL}/shows?limit=100`
      )
      const show = shows.data.find((s) => s.id === id)
      if (!show) throw new Error('Show not found')
      return {
        id: show.id,
        title: show.title,
        slug: show.slug,
        thumbnailUrl: show.thumbnailUrl
      }
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5
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

export type PublicProfile = {
  id: string
  name: string
  username: string | null
  image: string | null
  bio: string | null
  socialLinks: SocialLink[]
  createdAt: string
  content: {
    mixes: Array<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
      type: 'mix' | 'track' | 'misc'
      showId: string | null
    }>
    shows: Array<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
    }>
    editorials: Array<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
      description: string | null
      createdAt: string
    }>
    tweets: Array<{
      id: string
      title: string
      slug: string
      createdAt: string
    }>
  }
}

export type ResolvedProfile = {
  type: 'profile'
  data: PublicProfile
}

export type ResolvedShow = {
  type: 'show'
  data: {
    id: string
    title: string
    slug: string
    description: string | null
    thumbnailUrl: string | null
    bannerImageUrl: string | null
    tags: string[] | null
    createdAt: string
    compiledContent: string | null
    hosts: Array<{ id: string; name: string; username: string | null }>
  }
}

export type ResolveResult = ResolvedProfile | ResolvedShow

export function useResolveSlug(slug: string) {
  const { data, error, isPending } = useQuery<ResolveResult, Error>({
    queryKey: ['resolve', slug],
    queryFn: async () => {
      const res = await fetch(`${VPS_BASE_URL}/resolve/${slug}`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Not found')
      return res.json()
    },
    enabled: Boolean(slug),
    retry: false
  })

  return {
    data,
    error,
    isPending
  }
}

export function usePublicProfile(username: string) {
  const { data, error, isPending } = useQuery<PublicProfile, Error>({
    queryKey: ['profile', username],
    queryFn: async () => {
      const res = await fetch(`${VPS_BASE_URL}/profile/${username}`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Profile not found')
      const profile: PublicProfile = await res.json()
      if (!profile?.id) throw new Error('Profile not found')
      return profile
    },
    enabled: Boolean(username),
    retry: false
  })

  return {
    data,
    error,
    isPending
  }
}

type NewsletterSubscribeResponse = {
  subscribed: boolean
  email: string
}

export function useNewsletterSubscribe() {
  return useMutation<NewsletterSubscribeResponse, Error, { email: string }>({
    mutationFn: async ({ email }) =>
      fetcher<NewsletterSubscribeResponse>(
        `${VPS_BASE_URL}/newsletter/subscribe`,
        {
          method: 'POST',
          body: JSON.stringify({ email, source: 'subscribe_page' })
        }
      )
  })
}

type QRPdfResponse = {
  url: string
  cached: boolean
}

export function useMixQRPdf(
  slug: string,
  template: 'flyer' | 'qr' = 'flyer',
  enabled = false
) {
  return useQuery<QRPdfResponse>({
    queryKey: ['mix-qr-pdf', slug, template],
    queryFn: () =>
      fetcher<QRPdfResponse>(
        `${VPS_BASE_URL}/content/audio/mix/${slug}/qr-pdf?template=${template}`
      ),
    enabled,
    staleTime: 1000 * 60 * 60 * 24
  })
}
