import type { EmailDeliveryStatus, LinkStatus } from '@gbfm/core/status'
import type {
  SelectAudio,
  SelectLabel,
  SelectMdxCompiledAudio,
  SelectMdxCompiledEditorialPost,
  SelectMdxCompiledLabel,
  SelectMdxCompiledMicroPost,
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
import { RuntimeClient } from '@/runtime'
import { captureException } from '@/services/analytics'
import { useSession } from './auth-client'

type User = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  username?: string | null
  createdAt: Date
  updatedAt: Date
  role?: string | null
}

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

export type PaginationOptions = {
  limit?: number
}

type UseAudioByTypeOptions = PaginationOptions & {
  tag?: string
}

type UseAudioByTypeResult = {
  data: SelectAudio[]
  error: Error | null
  fetchNextPage: () => Promise<unknown>
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isPending: boolean
  refetch: () => Promise<unknown>
}

const DEFAULT_PAGE_SIZE = 5

function setPaginationParams(
  url: URL,
  pageParam: number,
  { limit = DEFAULT_PAGE_SIZE }: PaginationOptions = {}
) {
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(pageParam))
}

function getRequestUrl(input: RequestInfo) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function getRequestMethod(input: RequestInfo, init: RequestInit) {
  if (init.method) return init.method
  if (input instanceof Request) return input.method
  return 'GET'
}

function reportApiFailure(
  error: unknown,
  input: RequestInfo,
  init: RequestInit,
  context: Record<string, unknown> = {}
) {
  void RuntimeClient.runPromise(
    captureException(error, {
      url: getRequestUrl(input),
      method: getRequestMethod(input, init),
      ...context
    })
  ).catch((reportingError) => {
    console.error(reportingError)
  })
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
      const error = new Error(
        `HTTP ${res.status}: ${errorText || res.statusText}`
      )

      if (res.status >= 500) {
        reportApiFailure(error, input, init, {
          status: res.status,
          statusText: res.statusText,
          failureType: 'server_response'
        })
      }

      throw error
    }

    const text = await res.text()
    if (!text) return undefined as T
    return JSON.parse(text) as T
  } catch (error) {
    if (error instanceof TypeError) {
      reportApiFailure(error, input, init, { failureType: 'network' })
    }

    console.error(error)
    throw error
  }
}

export function useAudioByType(
  type: 'mix' | 'track' | 'misc',
  { tag, limit = DEFAULT_PAGE_SIZE }: UseAudioByTypeOptions = {}
): UseAudioByTypeResult {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    refetch
  } = useInfiniteQuery<PaginatedResponse<SelectAudio>, Error>({
    queryKey: ['audio', type, tag ?? null, limit],
    queryFn: async ({ pageParam = 0 }) => {
      const url = new URL(`${VPS_BASE_URL}/content/audio/${type}`)
      setPaginationParams(url, Number(pageParam), { limit })
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
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    refetch
  }
}

export function useAudioTags(type: 'mix' | 'track' | 'misc') {
  const { data, error, isPending } = useQuery<string[], Error>({
    queryKey: ['audio-tags', type],
    queryFn: async () =>
      fetcher<string[]>(`${VPS_BASE_URL}/content/audio/${type}/tags`),
    staleTime: 1000 * 60 * 60
  })
  return { data: data ?? [], error, isPending }
}

export function useEditorialTags() {
  const { data, error, isPending } = useQuery<string[], Error>({
    queryKey: ['editorial-tags'],
    queryFn: async () =>
      fetcher<string[]>(`${VPS_BASE_URL}/content/posts/editorials/tags`),
    staleTime: 1000 * 60 * 60
  })
  return { data: data ?? [], error, isPending }
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

export function useEditorialPosts(tag?: string, limit = DEFAULT_PAGE_SIZE) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    refetch
  } = useInfiniteQuery<
    PaginatedResponse<SelectMdxCompiledEditorialPost>,
    Error
  >({
    queryKey: ['posts', 'editorials', tag, limit],
    queryFn: async ({ pageParam = 0 }) => {
      const url = new URL(`${VPS_BASE_URL}/content/posts/editorials`)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('offset', String(pageParam))
      if (tag) url.searchParams.set('tag', tag)
      return fetcher<PaginatedResponse<SelectMdxCompiledEditorialPost>>(
        url.toString()
      )
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
    isFetchingNextPage,
    refetch
  }
}

export function useMicroPosts(limit = DEFAULT_PAGE_SIZE) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    refetch
  } = useInfiniteQuery<PaginatedResponse<SelectMdxCompiledMicroPost>, Error>({
    queryKey: ['posts', 'micro', limit],
    queryFn: async ({ pageParam = 0 }) => {
      const url = new URL(`${VPS_BASE_URL}/content/posts/micro`)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('offset', String(pageParam))
      return fetcher<PaginatedResponse<SelectMdxCompiledMicroPost>>(
        url.toString()
      )
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
    isFetchingNextPage,
    refetch
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
    enabled: Boolean(url) && url.length > 10, // Only run if URL is reasonably long
    staleTime: 15 * 60 * 1000
  })
  return {
    data,
    isLoading,
    error
  }
}

export type ResolvedMusicEntity = {
  entityType: 'album' | 'track' | 'playlist'
  entity: {
    id: string
    title: string
    slug: string
    coverImageUrl: string | null
    artistNames?: string[] | null
    description?: string | null
  }
  links: Array<{
    platform: string
    url: string
  }>
  coverImageUrl: string | null
}

export function useResolveMusicEntity(url: string) {
  const { data, error, isLoading } = useQuery<ResolvedMusicEntity>({
    queryKey: ['music/resolve', url],
    queryFn: async () =>
      fetcher(`${VPS_BASE_URL}/music/resolve`, {
        method: 'POST',
        body: JSON.stringify({ url })
      }),
    enabled: Boolean(url) && url.length > 10,
    staleTime: 15 * 60 * 1000
  })

  return {
    data,
    error,
    isLoading
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

export type EmailLogStatus = EmailDeliveryStatus

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
  limit = 10,
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

type NewsletterSubscriber = {
  id: string
  email: string
  name: string | null
  source: string | null
  unsubscribedAt: string | null
  createdAt: string
}

export function useAdminNewsletterSubscribers() {
  return useQuery<{ subscribers: NewsletterSubscriber[] }, Error>({
    queryKey: ['admin', 'newsletter-subscribers'],
    queryFn: async () => fetcher(`${VPS_BASE_URL}/admin/newsletter-subscribers`)
  })
}

export function useAllLabels({
  limit = DEFAULT_PAGE_SIZE
}: PaginationOptions = {}) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending
  } = useInfiniteQuery<PaginatedResponse<SelectLabel>, Error>({
    queryKey: ['labels', limit],
    queryFn: async ({ pageParam = 0 }) => {
      const url = new URL(`${VPS_BASE_URL}/content/labels`)
      setPaginationParams(url, Number(pageParam), { limit })
      return fetcher<PaginatedResponse<SelectLabel>>(url.toString())
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

export function useReleasesByLabel(
  labelSlug: string,
  { limit = DEFAULT_PAGE_SIZE }: PaginationOptions = {}
) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending
  } = useInfiniteQuery<PaginatedResponse<SelectRelease>, Error>({
    queryKey: ['releases', 'label', labelSlug, limit],
    queryFn: async ({ pageParam = 0 }) => {
      const url = new URL(
        `${VPS_BASE_URL}/content/labels/${labelSlug}/releases`
      )
      setPaginationParams(url, Number(pageParam), { limit })
      return fetcher<PaginatedResponse<SelectRelease>>(url.toString())
    },
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
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
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

export function useAllShows({
  limit = DEFAULT_PAGE_SIZE
}: PaginationOptions = {}) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending
  } = useInfiniteQuery<PaginatedResponse<ShowWithHosts>, Error>({
    queryKey: ['shows', limit],
    queryFn: async ({ pageParam = 0 }) => {
      const url = new URL(`${VPS_BASE_URL}/shows`)
      setPaginationParams(url, Number(pageParam), { limit })
      return fetcher<PaginatedResponse<ShowWithHosts>>(url.toString())
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

export function useShowEpisodes(
  slug: string,
  { limit = DEFAULT_PAGE_SIZE }: PaginationOptions = {}
) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending
  } = useInfiniteQuery<PaginatedResponse<SelectAudio>, Error>({
    queryKey: ['show-episodes', slug, limit],
    queryFn: async ({ pageParam = 0 }) => {
      const url = new URL(`${VPS_BASE_URL}/shows/${slug}/episodes`)
      setPaginationParams(url, Number(pageParam), { limit })
      return fetcher<PaginatedResponse<SelectAudio>>(url.toString())
    },
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
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
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
      title: string | null
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
      return fetcher<ResolveResult>(`${VPS_BASE_URL}/resolve/${slug}`)
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

export type DjListItem = {
  id: string
  name: string
  username: string | null
  image: string | null
  bio: string | null
  mixCount: number
}

export function useDjs() {
  return useQuery<DjListItem[], Error>({
    queryKey: ['djs'],
    queryFn: () => fetcher<DjListItem[]>(`${VPS_BASE_URL}/user/djs`),
    staleTime: 1000 * 60 * 5
  })
}

export function usePublicProfile(username: string) {
  const { data, error, isPending } = useQuery<PublicProfile, Error>({
    queryKey: ['profile', username],
    queryFn: async () => {
      const profile = await fetcher<PublicProfile>(
        `${VPS_BASE_URL}/profile/${username}`
      )
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
  return useMutation<
    NewsletterSubscribeResponse,
    Error,
    { email: string; name?: string }
  >({
    mutationFn: async ({ email, name }) =>
      fetcher<NewsletterSubscribeResponse>(
        `${VPS_BASE_URL}/newsletter/subscribe`,
        {
          method: 'POST',
          body: JSON.stringify({ email, name, source: 'subscribe_page' })
        }
      )
  })
}

export function useNewsletterUnsubscribe() {
  return useMutation<{ success: boolean }, Error, { token: string }>({
    mutationFn: async ({ token }) =>
      fetcher<{ success: boolean }>(`${VPS_BASE_URL}/newsletter/unsubscribe`, {
        method: 'POST',
        body: JSON.stringify({ token })
      })
  })
}

export function useRequestNewsletterUnsubscribe() {
  return useMutation<{ sent: boolean }, Error, { email: string }>({
    mutationFn: async ({ email }) =>
      fetcher<{ sent: boolean }>(
        `${VPS_BASE_URL}/newsletter/request-unsubscribe`,
        {
          method: 'POST',
          body: JSON.stringify({ email })
        }
      )
  })
}

type QRPdfResponse = {
  url: string
  cached: boolean
}

export function useMixQRPdf(slug: string, enabled = false) {
  return useQuery<QRPdfResponse>({
    queryKey: ['mix-qr-pdf', slug],
    queryFn: () =>
      fetcher<QRPdfResponse>(
        `${VPS_BASE_URL}/content/audio/mix/${slug}/qr-pdf`
      ),
    enabled,
    staleTime: 1000 * 60 * 60 * 24
  })
}

export function useShowQRPdf(slug: string, enabled = false) {
  return useQuery<QRPdfResponse>({
    queryKey: ['show-qr-pdf', slug],
    queryFn: () =>
      fetcher<QRPdfResponse>(`${VPS_BASE_URL}/shows/${slug}/qr-pdf`),
    enabled,
    staleTime: 1000 * 60 * 60 * 24
  })
}

// ---------------------------------------------------------------------------
// Music entities — admin hooks
// ---------------------------------------------------------------------------

export interface MusicArtist {
  id: string
  name: string
  bio: string | null
  imageUrl: string | null
  genres: string[] | null
  slug: string
  publishedAt: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface MusicAlbum {
  id: string
  title: string
  artistNames: string[] | null
  releaseDate: string | null
  coverImageUrl: string | null
  genres: string[] | null
  albumType: string | null
  slug: string
  publishedAt: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface MusicTrack {
  id: string
  title: string
  artistNames: string[] | null
  coverImageUrl: string | null
  albumId: string | null
  trackNumber: number | null
  slug: string
  publishedAt: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminMusicEntityLink {
  id: string
  entityType: string
  entityId: string
  platform: string
  url: string
  status: LinkStatus
  scrapedAt: string | null
  verifiedAt: string | null
  verifiedBy: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export function useAdminArtists() {
  return useQuery<MusicArtist[]>({
    queryKey: ['admin', 'artists'],
    queryFn: () => fetcher(`${VPS_BASE_URL}/music/artists`)
  })
}

export function useAdminArtist(id: string) {
  return useQuery<MusicArtist>({
    queryKey: ['admin', 'artists', id],
    queryFn: () => fetcher(`${VPS_BASE_URL}/music/artists/${id}`),
    enabled: Boolean(id)
  })
}

export function useUpdateAdminArtist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetcher<MusicArtist>(`${VPS_BASE_URL}/music/artists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'artists', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'artists'] })
    }
  })
}

export function useDeleteAdminArtist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`${VPS_BASE_URL}/music/artists/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'artists'] })
  })
}

export function useAdminAlbums() {
  return useQuery<MusicAlbum[]>({
    queryKey: ['admin', 'albums'],
    queryFn: () => fetcher(`${VPS_BASE_URL}/music/albums`)
  })
}

export function useAdminAlbum(id: string) {
  return useQuery<MusicAlbum>({
    queryKey: ['admin', 'albums', id],
    queryFn: () => fetcher(`${VPS_BASE_URL}/music/albums/${id}`),
    enabled: Boolean(id)
  })
}

export function useUpdateAdminAlbum() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetcher<MusicAlbum>(`${VPS_BASE_URL}/music/albums/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'albums', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'albums'] })
    }
  })
}

export function useDeleteAdminAlbum() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`${VPS_BASE_URL}/music/albums/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'albums'] })
  })
}

export function useAdminTracks() {
  return useQuery<MusicTrack[]>({
    queryKey: ['admin', 'tracks'],
    queryFn: () => fetcher(`${VPS_BASE_URL}/music/tracks`)
  })
}

export function useAdminTrack(id: string) {
  return useQuery<MusicTrack>({
    queryKey: ['admin', 'tracks', id],
    queryFn: () => fetcher(`${VPS_BASE_URL}/music/tracks/${id}`),
    enabled: Boolean(id)
  })
}

export function useUpdateAdminTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetcher<MusicTrack>(`${VPS_BASE_URL}/music/tracks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'tracks', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'tracks'] })
    }
  })
}

export function useDeleteAdminTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`${VPS_BASE_URL}/music/tracks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tracks'] })
  })
}

export function useAdminEntityLinks(
  entityType: string,
  entityId: string,
  enabled = true
) {
  return useQuery<AdminMusicEntityLink[]>({
    queryKey: ['admin', 'links', entityType, entityId],
    queryFn: () =>
      fetcher(`${VPS_BASE_URL}/music/${entityType}/${entityId}/links`),
    enabled: enabled && Boolean(entityId)
  })
}

export function useAddAdminEntityLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
      platform,
      url
    }: {
      entityType: string
      entityId: string
      platform: string
      url: string
      status?: LinkStatus
    }) =>
      fetcher<AdminMusicEntityLink>(
        `${VPS_BASE_URL}/music/${entityType}/${entityId}/links`,
        { method: 'POST', body: JSON.stringify({ platform, url, status }) }
      ),
    onSuccess: (_, { entityType, entityId }) =>
      qc.invalidateQueries({
        queryKey: ['admin', 'links', entityType, entityId]
      })
  })
}

export function useUpdateAdminEntityLinkStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
      linkId,
      status
    }: {
      entityType: string
      entityId: string
      linkId: string
      status: LinkStatus
    }) =>
      fetcher<AdminMusicEntityLink>(
        `${VPS_BASE_URL}/music/${entityType}/${entityId}/links/${linkId}`,
        { method: 'PATCH', body: JSON.stringify({ status }) }
      ),
    onSuccess: (_, { entityType, entityId }) =>
      qc.invalidateQueries({
        queryKey: ['admin', 'links', entityType, entityId]
      })
  })
}

export function useDeleteAdminEntityLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
      linkId
    }: {
      entityType: string
      entityId: string
      linkId: string
    }) =>
      fetcher(
        `${VPS_BASE_URL}/music/${entityType}/${entityId}/links/${linkId}`,
        { method: 'DELETE' }
      ),
    onSuccess: (_, { entityType, entityId }) =>
      qc.invalidateQueries({
        queryKey: ['admin', 'links', entityType, entityId]
      })
  })
}

export function useAddArtistToAlbum() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      albumId,
      artistId,
      role
    }: {
      albumId: string
      artistId: string
      role?: string
    }) =>
      fetcher(`${VPS_BASE_URL}/music/albums/${albumId}/artists/${artistId}`, {
        method: 'PUT',
        body: JSON.stringify({ role })
      }),
    onSuccess: (_, { albumId }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'links', 'album', albumId] })
  })
}

export function useRemoveArtistFromAlbum() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      albumId,
      artistId
    }: {
      albumId: string
      artistId: string
    }) =>
      fetcher(`${VPS_BASE_URL}/music/albums/${albumId}/artists/${artistId}`, {
        method: 'DELETE'
      }),
    onSuccess: (_, { albumId }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'links', 'album', albumId] })
  })
}

export function useAddArtistToTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      trackId,
      artistId,
      role
    }: {
      trackId: string
      artistId: string
      role?: string
    }) =>
      fetcher(`${VPS_BASE_URL}/music/tracks/${trackId}/artists/${artistId}`, {
        method: 'PUT',
        body: JSON.stringify({ role })
      }),
    onSuccess: (_, { trackId }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'links', 'track', trackId] })
  })
}

export function useRemoveArtistFromTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      trackId,
      artistId
    }: {
      trackId: string
      artistId: string
    }) =>
      fetcher(`${VPS_BASE_URL}/music/tracks/${trackId}/artists/${artistId}`, {
        method: 'DELETE'
      }),
    onSuccess: (_, { trackId }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'links', 'track', trackId] })
  })
}
