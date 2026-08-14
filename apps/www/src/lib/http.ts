import type {
  EmailLogsResponse,
  SendMixNotificationInput,
  SendMixNotificationResponse
} from '@gbfm/api/email'
import type { CreateMusicReminderInput } from '@gbfm/api/music-reminders'
import type {
  EntityLinkResponse,
  LabelResponse,
  UpdateAlbumInput,
  UpdateArtistInput,
  UpdateLabelInput,
  UpdateTrackInput
} from '@gbfm/api/music'
import type { LinkStatus } from '@gbfm/core/status'
import type {
  SelectAudio,
  SelectMdxCompiledAudio,
  SelectMdxCompiledEditorialPost,
  SelectMdxCompiledMicroPost,
  SelectMdxCompiledRelease,
  SelectMdxCompiledShow,
  SelectShow,
  SelectShowSubscription
} from '@gbfm/server/schemas'
import { useCallback } from 'react'
import { Effect, Option, Schema } from 'effect'
import { HttpApiError } from 'effect/unstable/httpapi'
import {
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { RuntimeClient } from '@/runtime'
import { captureException } from '@/services/analytics'
import { getApiClient } from './api-client'
import { useSession } from './auth-client'
import { createFetcher, getRequestMethod, getRequestUrl, type ApiFailureInput } from './http-client'
import {
  DEFAULT_PAGE_SIZE,
  getNextOffsetPageParam,
  type PaginatedResponse,
  type PaginationOptions
} from './http-pagination'
import {
  audioListQueryKey,
  audioSlugQueryKey,
  audioTagsQueryKey,
  favoritesQueryKey,
  type AudioContentType,
  userSubscriptionsQueryKey
} from './http-query-keys'
import { apiUrl, apiUrlObj, publicUrl, publicUrlObj } from './http-url'
export { apiUrl, apiUrlObj, publicUrl, publicUrlObj }

type User = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  username?: string | null
  role?: string | null
}

import type { AlbumApiResponse, PlaylistApiResponse, TrackAPIResponse } from '@/types'

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

export { DEFAULT_PAGE_SIZE, getNextOffsetPageParam }
export type { PaginatedResponse, PaginationOptions }

const reportApiFailure = ({ error, input, init, context = {} }: ApiFailureInput) =>
  captureException(error, {
    url: getRequestUrl(input),
    method: getRequestMethod(input, init),
    ...context
  })

export const fetcher = createFetcher({
  reportFailure: reportApiFailure,
  runEffect: RuntimeClient.runPromise
})

export function useAudioByType(
  type: AudioContentType,
  { tag, limit = DEFAULT_PAGE_SIZE }: UseAudioByTypeOptions = {}
): UseAudioByTypeResult {
  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, refetch } =
    useInfiniteQuery<PaginatedResponse<SelectAudio>, Error>({
      queryKey: audioListQueryKey(type, tag, limit),
      queryFn: async ({ pageParam = 0 }) => {
        const client = await getApiClient()
        const result = await Effect.runPromise(
          client.audio
            .getAudioByType({ params: { type }, query: { limit, offset: Number(pageParam), tag } })
            .pipe(
              Effect.tapError((error) =>
                captureException(error, { endpoint: 'audio.getAudioByType' })
              )
            )
        )
        return {
          data: result.data.map((audio) => ({
            ...audio,
            bannerImageUrl: null,
            createdAt: new Date(audio.createdAt),
            updatedAt: new Date(audio.updatedAt),
            tags: audio.tags ? [...audio.tags] : null,
            creators: audio.creators ? [...audio.creators] : undefined
          })),
          pagination: result.pagination
        }
      },
      initialPageParam: 0,
      getNextPageParam: getNextOffsetPageParam
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

export function useAudioTags(type: AudioContentType) {
  const { data, error, isPending } = useQuery<string[], Error>({
    queryKey: audioTagsQueryKey(type),
    queryFn: async () => {
      const client = await getApiClient()
      const tags = await Effect.runPromise(
        client.audio
          .getAudioTags({ params: { type } })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'audio.getAudioTags' }))
          )
      )
      return [...tags]
    },
    staleTime: 1000 * 60 * 60
  })
  return { data: data ?? [], error, isPending }
}

export function useEditorialTags() {
  const { data, error, isPending } = useQuery<string[], Error>({
    queryKey: ['editorial-tags'],
    queryFn: async () => {
      const client = await getApiClient()
      const tags = await Effect.runPromise(
        client.post
          .getEditorialTags({})
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'post.getEditorialTags' })
            )
          )
      )
      return [...tags]
    },
    staleTime: 1000 * 60 * 60
  })
  return { data: data ?? [], error, isPending }
}

export function useAudioBySlug(type: AudioContentType, slug: string) {
  const { data, error, isPending } = useQuery<SelectMdxCompiledAudio, Error>({
    queryKey: audioSlugQueryKey(type, slug),
    queryFn: async () => {
      const client = await getApiClient()
      const audio = await Effect.runPromise(
        client.audio
          .getAudioBySlug({ params: { type, slug } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'audio.getAudioBySlug' })
            )
          )
      )
      return {
        ...audio,
        bannerImageUrl: null,
        createdAt: new Date(audio.createdAt),
        updatedAt: new Date(audio.updatedAt),
        tags: audio.tags ? [...audio.tags] : null,
        creators: audio.creators ? [...audio.creators] : undefined
      }
    },
    enabled: Boolean(slug)
  })

  return {
    data,
    error,
    isPending
  }
}

export function useAudioBySlugForEdit(type: AudioContentType, slug: string) {
  const { data, error, isPending } = useQuery<SelectMdxCompiledAudio, Error>({
    queryKey: [...audioSlugQueryKey(type, slug), 'edit'],
    queryFn: async () => {
      const client = await getApiClient()
      const audio = await Effect.runPromise(
        client.audio
          .getAudioBySlugForEdit({ params: { type, slug } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'audio.getAudioBySlugForEdit' })
            )
          )
      )
      return {
        ...audio,
        bannerImageUrl: null,
        createdAt: new Date(audio.createdAt),
        updatedAt: new Date(audio.updatedAt),
        tags: audio.tags ? [...audio.tags] : null,
        creators: audio.creators ? [...audio.creators] : undefined
      }
    },
    enabled: Boolean(slug)
  })

  return { data, error, isPending }
}

export function useEditorialPosts(tag?: string, limit = DEFAULT_PAGE_SIZE) {
  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, refetch } =
    useInfiniteQuery<PaginatedResponse<SelectMdxCompiledEditorialPost>, Error>({
      queryKey: ['posts', 'editorials', tag, limit],
      queryFn: async ({ pageParam = 0 }) => {
        const client = await getApiClient()
        const result = await Effect.runPromise(
          client.post
            .getEditorialPosts({ query: { limit, offset: Number(pageParam), tag } })
            .pipe(
              Effect.tapError((error) =>
                captureException(error, { endpoint: 'post.getEditorialPosts' })
              )
            )
        )
        return {
          data: result.data.map((post) => ({
            ...post,
            bannerImageUrl: null,
            createdAt: new Date(post.createdAt),
            updatedAt: new Date(post.updatedAt),
            tags: post.tags ? [...post.tags] : null,
            creators: post.creators ? [...post.creators] : undefined
          })),
          pagination: result.pagination
        }
      },
      initialPageParam: 0,
      getNextPageParam: getNextOffsetPageParam
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

export function useMicroPosts(limit = DEFAULT_PAGE_SIZE, tag?: string) {
  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, refetch } =
    useInfiniteQuery<PaginatedResponse<SelectMdxCompiledMicroPost>, Error>({
      queryKey: ['posts', 'micro', limit, tag],
      queryFn: async ({ pageParam = 0 }) => {
        const client = await getApiClient()
        const result = await Effect.runPromise(
          client.post
            .getMicroPosts({ query: { limit, offset: Number(pageParam), tag } })
            .pipe(
              Effect.tapError((error) =>
                captureException(error, { endpoint: 'post.getMicroPosts' })
              )
            )
        )
        return {
          data: result.data.map((post) => ({
            ...post,
            bannerImageUrl: null,
            createdAt: new Date(post.createdAt),
            updatedAt: new Date(post.updatedAt),
            tags: post.tags ? [...post.tags] : null,
            creators: post.creators ? [...post.creators] : undefined
          })),
          pagination: result.pagination
        }
      },
      initialPageParam: 0,
      getNextPageParam: getNextOffsetPageParam
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

export function useMicroTags() {
  const { data, error, isPending, refetch } = useQuery<string[], Error>({
    queryKey: ['posts', 'micro', 'tags'],
    queryFn: async () => {
      const client = await getApiClient()
      const tags = await Effect.runPromise(
        client.post
          .getMicroTags()
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'post.getMicroTags' }))
          )
      )
      return [...tags]
    },
    staleTime: 1000 * 60 * 60
  })
  return { data: data ?? [], error, isPending, refetch }
}

export function useMicroPostSearch(q: string, limit = DEFAULT_PAGE_SIZE) {
  const trimmed = q.trim()
  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, refetch } =
    useInfiniteQuery<PaginatedResponse<SelectMdxCompiledMicroPost>, Error>({
      queryKey: ['posts', 'micro', 'search', trimmed, limit],
      queryFn: async ({ pageParam = 0 }) => {
        const client = await getApiClient()
        const result = await Effect.runPromise(
          client.post
            .searchMicroPosts({ query: { q: trimmed, limit, offset: Number(pageParam) } })
            .pipe(
              Effect.tapError((error) =>
                captureException(error, { endpoint: 'post.searchMicroPosts' })
              )
            )
        )
        return {
          data: result.data.map((post) => ({
            ...post,
            bannerImageUrl: null,
            createdAt: new Date(post.createdAt),
            updatedAt: new Date(post.updatedAt),
            tags: post.tags ? [...post.tags] : null,
            creators: post.creators ? [...post.creators] : undefined
          })),
          pagination: result.pagination
        }
      },
      initialPageParam: 0,
      getNextPageParam: getNextOffsetPageParam,
      enabled: trimmed.length > 0
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

export function useGlobalSearch(q: string, limit = 10) {
  const trimmed = q.trim()
  const { data, error, isPending } = useQuery({
    queryKey: ['search', 'global', trimmed, limit],
    queryFn: async () => {
      const client = await getApiClient()
      const result = await Effect.runPromise(
        client.search
          .searchContent({ query: { q: trimmed, limit } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'search.searchContent' })
            )
          )
      )
      return result
    },
    enabled: trimmed.length > 0
  })
  return { data, error, isPending }
}

export const navigateMicroPostsEffect = (
  payload: Parameters<
    Awaited<ReturnType<typeof getApiClient>>['navigation']['navigateMicroPosts']
  >[0]['payload']
) =>
  Effect.promise(() => getApiClient()).pipe(
    Effect.flatMap((client) => client.navigation.navigateMicroPosts({ payload })),
    Effect.retry({
      times: 1,
      while: (error) => error instanceof HttpApiError.InternalServerError
    }),
    Effect.tapError((error) =>
      Effect.sync(() => captureException(error, { endpoint: 'navigation.navigateMicroPosts' }))
    )
  )

export function useNavigateMicroPosts() {
  const navigate = useCallback(navigateMicroPostsEffect, [])
  return { navigateMicroPostsEffect: navigate }
}

export function useEditorialPostBySlug(slug: string) {
  const { data, error, isPending } = useQuery<SelectMdxCompiledEditorialPost, Error>({
    queryKey: ['post', 'editorial', slug],
    queryFn: async () => {
      const client = await getApiClient()
      const post = await Effect.runPromise(
        client.post
          .getEditorialPostBySlug({ params: { slug } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'post.getEditorialPostBySlug' })
            )
          )
      )
      return {
        ...post,
        bannerImageUrl: null,
        createdAt: new Date(post.createdAt),
        updatedAt: new Date(post.updatedAt),
        tags: post.tags ? [...post.tags] : null,
        creators: post.creators ? [...post.creators] : undefined
      }
    },
    enabled: Boolean(slug)
  })

  return {
    data,
    error,
    isPending
  }
}

// Scans free text for the first substring containing /tweet/:slug (any host,
// so local IP / staging / prod links all match) and returns just the slug.
// Used to auto-detect a quoted tweet from body text instead of a separate input.
const TWEET_LINK_PATTERN = /\/tweet\/([^\s/?#]+)/

const TweetSlugSchema = Schema.NonEmptyString

export function extractTweetSlugFromText(text: string): string {
  const match = text.match(TWEET_LINK_PATTERN)

  return Schema.decodeUnknownOption(TweetSlugSchema)(match?.[1]).pipe(Option.getOrElse(() => ''))
}

export function useMicroPostBySlug(slug: string) {
  const { data, error, isPending } = useQuery<SelectMdxCompiledMicroPost, Error>({
    queryKey: ['post', 'micro', slug],
    queryFn: async () => {
      const client = await getApiClient()
      const post = await Effect.runPromise(
        client.post
          .getMicroPostBySlug({ params: { slug } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'post.getMicroPostBySlug' })
            )
          )
      )
      return {
        ...post,
        bannerImageUrl: null,
        createdAt: new Date(post.createdAt),
        updatedAt: new Date(post.updatedAt),
        tags: post.tags ? [...post.tags] : null,
        creators: post.creators ? [...post.creators] : undefined
      }
    },
    enabled: Boolean(slug)
  })

  return {
    data,
    error,
    isPending
  }
}

export const microPostByIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['post', 'micro', 'by-id', id],
    queryFn: async () => {
      const client = await getApiClient()
      const post = await Effect.runPromise(
        client.post
          .getMicroPostById({ params: { id } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'post.getMicroPostById' })
            )
          )
      )
      return {
        ...post,
        bannerImageUrl: null,
        createdAt: new Date(post.createdAt),
        updatedAt: new Date(post.updatedAt),
        tags: post.tags ? [...post.tags] : null,
        creators: post.creators ? [...post.creators] : undefined
      }
    },
    enabled: Boolean(id)
  })

export function useMicroPostById(id: string) {
  const { data, error, isPending } = useQuery(microPostByIdQueryOptions(id))

  return {
    data,
    error,
    isPending
  }
}

const microPostRepliesQueryKey = (parentSlug: string) => ['micro-post-replies', parentSlug]

export const microPostRepliesQueryOptions = (parentSlug: string, limit = 20) =>
  queryOptions({
    queryKey: microPostRepliesQueryKey(parentSlug),
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.post
          .getMicroPostReplies({ params: { parentSlug }, query: { limit, offset: 0 } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'post.getMicroPostReplies' })
            )
          )
      )
    },
    enabled: Boolean(parentSlug)
  })

export function useMicroPostReplies(parentSlug: string, limit = 20) {
  return useQuery(microPostRepliesQueryOptions(parentSlug, limit))
}

export type CreateMicroPostReplyPayload = {
  content: string
  musicEntityType?: 'album' | 'track' | 'playlist' | null
  musicEntityId?: string | null
  quotedPostId?: string | null
}

export function useCreateMicroPostReply(parentSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      content,
      musicEntityType,
      musicEntityId,
      quotedPostId
    }: CreateMicroPostReplyPayload) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.post
          .createMicroPostReply({
            params: { parentSlug },
            payload: { content, musicEntityType, musicEntityId, quotedPostId }
          })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'post.createMicroPostReply' })
            )
          )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: microPostRepliesQueryKey(parentSlug) })
    }
  })
}

type SpotifyContentType = 'album' | 'track' | 'playlist'

type SpotifyProxyInput<T extends SpotifyContentType> = {
  id: string
  spotifyContentType: T
}

export const spotifyAlbumProxyQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['spotify/proxy', 'album', id],
    queryFn: async (): Promise<AlbumApiResponse> => {
      const client = await getApiClient()
      const album = await Effect.runPromise(
        client.spotify
          .getSpotifyAlbum({ payload: { id } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'spotify.getSpotifyAlbum' })
            )
          )
      )
      return { ...album, tracks: album.tracks.map((track) => ({ ...track })) }
    },
    staleTime: 15 * 60 * 1000
  })

const useSpotifyAlbumProxy = (id: string, enabled: boolean) => {
  const { data, error, isLoading } = useQuery({
    ...spotifyAlbumProxyQueryOptions(id),
    enabled
  })
  return { data, isLoading, error }
}

export const spotifyTrackProxyQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['spotify/proxy', 'track', id],
    queryFn: async (): Promise<TrackAPIResponse> => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.spotify
          .getSpotifyTrack({ payload: { id } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'spotify.getSpotifyTrack' })
            )
          )
      )
    },
    staleTime: 15 * 60 * 1000
  })

const useSpotifyTrackProxy = (id: string, enabled: boolean) => {
  const { data, error, isLoading } = useQuery({
    ...spotifyTrackProxyQueryOptions(id),
    enabled
  })
  return { data, isLoading, error }
}

export const spotifyPlaylistProxyQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['spotify/proxy', 'playlist', id],
    queryFn: async (): Promise<PlaylistApiResponse> => {
      const client = await getApiClient()
      const playlist = await Effect.runPromise(
        client.spotify
          .getSpotifyPlaylist({ payload: { id } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'spotify.getSpotifyPlaylist' })
            )
          )
      )
      return {
        ...playlist,
        coverImageUrl: playlist.coverImageUrl ?? '',
        description: playlist.description ?? '',
        ownerName: playlist.ownerName ?? '',
        tracks: playlist.tracks.map((track) => ({ ...track }))
      }
    },
    staleTime: 15 * 60 * 1000
  })

const useSpotifyPlaylistProxy = (id: string, enabled: boolean) => {
  const { data, error, isLoading } = useQuery({
    ...spotifyPlaylistProxyQueryOptions(id),
    enabled
  })
  return { data, isLoading, error }
}

// No single proxy endpoint server-side -- getSpotifyTrack/Album/Playlist are
// three separate endpoints with different response shapes. Each content type
// gets its own concretely-typed hook, and the three overload signatures below
// let each call site's literal `spotifyContentType` resolve to its own real
// return type -- no runtime-to-generic type correlation needed, since
// overload resolution is exactly what handles "the literal argument picks
// the static return type" natively. React's rules of hooks require calling
// all three unconditionally; `enabled` keeps the two inactive ones from ever
// actually querying.
export function useSpotifyProxy(input: SpotifyProxyInput<'album'>): {
  data: AlbumApiResponse | undefined
  isLoading: boolean
  error: Error | null
}
export function useSpotifyProxy(input: SpotifyProxyInput<'track'>): {
  data: TrackAPIResponse | undefined
  isLoading: boolean
  error: Error | null
}
export function useSpotifyProxy(input: SpotifyProxyInput<'playlist'>): {
  data: PlaylistApiResponse | undefined
  isLoading: boolean
  error: Error | null
}
export function useSpotifyProxy({ id, spotifyContentType }: SpotifyProxyInput<SpotifyContentType>) {
  const isAlbum = spotifyContentType === 'album'
  const isTrack = spotifyContentType === 'track'
  const isPlaylist = spotifyContentType === 'playlist'

  const album = useSpotifyAlbumProxy(id, isAlbum)
  const track = useSpotifyTrackProxy(id, isTrack)
  const playlist = useSpotifyPlaylistProxy(id, isPlaylist)

  if (isAlbum) return album
  if (isTrack) return track
  return playlist
}

export type EnrichedTrack = {
  title: string
  artist: string
  url: string
  platform: 'spotify' | 'youtube' | 'apple_music' | 'bandcamp' | 'other'
  thumbnailUrl?: string
  duration?: number
  album?: string
}

export function useEnrichTrackFromUrl(url: string) {
  const { data, error, isLoading } = useQuery<EnrichedTrack>({
    queryKey: ['spotify/enrich', url],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.spotify
          .enrichSpotifyTrackFromUrl({ payload: { url: new URL(url) } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'spotify.enrichSpotifyTrackFromUrl' })
            )
          )
      )
    },
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
  const { data, error, isLoading, isRefetching, refetch } = useQuery<ResolvedMusicEntity>({
    queryKey: ['music/resolve', url],
    queryFn: async () =>
      fetcher(apiUrl('/music/resolve'), {
        method: 'POST',
        body: JSON.stringify({ url })
      }),
    enabled: Boolean(url) && url.length > 10,
    retry: false,
    staleTime: 15 * 60 * 1000
  })

  return {
    data,
    error,
    isLoading,
    isRefetching,
    refetch
  }
}

export function useUserLOL() {
  const { data, error, isPending } = useQuery<User, Error>({
    queryKey: ['user'],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.user
          .getProfile({})
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'user.getProfile' }))
          )
      )
    }
  })

  return {
    data,
    error,
    isPending
  }
}

export function useUpdateProfile() {
  const { mutateAsync: updateProfile, isPending } = useMutation<User, Error, FormData | User>({
    mutationFn: async (data) =>
      fetcher(apiUrl('/user/profile'), {
        method: 'PATCH',
        body: data instanceof FormData ? data : JSON.stringify(data)
      })
  })

  return {
    updateProfile,
    isPending
  }
}

export function useSocialLinks() {
  return useQuery<SocialLink[], Error>({
    queryKey: ['user', 'social-links'],
    queryFn: async () => {
      const client = await getApiClient()
      const links = await Effect.runPromise(
        client.user
          .getSocialLinks()
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'user.getSocialLinks' }))
          )
      )
      return links.map((link) => ({ ...link }))
    }
  })
}

export function useReplaceSocialLinks() {
  const queryClient = useQueryClient()
  return useMutation<SocialLink[], Error, SocialLink[]>({
    mutationFn: async (links) => {
      const client = await getApiClient()
      const result = await Effect.runPromise(
        client.user
          .replaceSocialLinks({ payload: links })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'user.replaceSocialLinks' })
            )
          )
      )
      return result.map((link) => ({ ...link }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'social-links'] })
    }
  })
}

export function useAdminUserSocialLinks(userId: string) {
  return useQuery<SocialLink[], Error>({
    queryKey: ['admin', 'user-social-links', userId],
    queryFn: async () => {
      const client = await getApiClient()
      const links = await Effect.runPromise(
        client.user
          .getAdminUserSocialLinks({ params: { userId } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'user.getAdminUserSocialLinks' })
            )
          )
      )
      return links.map((link) => ({ ...link }))
    },
    enabled: Boolean(userId)
  })
}

export function useReplaceAdminUserSocialLinks() {
  const queryClient = useQueryClient()
  return useMutation<SocialLink[], Error, { userId: string; links: SocialLink[] }>({
    mutationFn: async ({ userId, links }) => {
      const client = await getApiClient()
      const result = await Effect.runPromise(
        client.user
          .replaceAdminUserSocialLinks({ params: { userId }, payload: links })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'user.replaceAdminUserSocialLinks' })
            )
          )
      )
      return result.map((link) => ({ ...link }))
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'user-social-links', variables.userId]
      })
    }
  })
}

export function useUpdateAdminUserBio() {
  return useMutation<{ bio: string | null }, Error, { userId: string; bio: string }>({
    mutationFn: async ({ userId, bio }) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.user
          .updateAdminUserBio({ params: { userId }, payload: { bio, image: undefined } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'user.updateAdminUserBio' })
            )
          )
      )
    }
  })
}

export function useAdminUserBio(userId: string) {
  return useQuery<{ bio: string | null }, Error>({
    queryKey: ['admin', 'user-bio', userId],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.user
          .getAdminUserBio({ params: { userId } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'user.getAdminUserBio' })
            )
          )
      )
    },
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
  createdAt: string
  updatedAt: string
}

export function useEmailPreferences() {
  const { data, error, isPending } = useQuery<EmailPreferences, Error>({
    queryKey: ['email-preferences'],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.user
          .getEmailPreferences({})
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'user.getEmailPreferences' })
            )
          )
      )
    }
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
    mutationFn: async (preferences) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.user
          .updateEmailPreferences({ payload: preferences })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'user.updateEmailPreferences' })
            )
          )
      )
    }
  })

  return {
    updateEmailPreferences,
    isPending
  }
}

export type EmailLogStatus = EmailLogsResponse['data'][number]['status']
export type AdminEmailLog = EmailLogsResponse['data'][number]

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
  return useQuery<EmailLogsResponse, Error>({
    queryKey: ['admin', 'email-logs', limit, offset, status, recipientEmail, dateFrom, dateTo],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.email
          .getEmailLogs({ query: { limit, offset, status, recipientEmail, dateFrom, dateTo } })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'email.getEmailLogs' }))
          )
      )
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
    queryFn: async () => {
      const client = await getApiClient()
      const result = await Effect.runPromise(
        client.admin
          .getNewsletterSubscribers({})
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'admin.getNewsletterSubscribers' })
            )
          )
      )
      return { subscribers: result.subscribers.map((s) => ({ ...s })) }
    }
  })
}

export function useReleaseBySlug(slug: string) {
  const { data, error, isPending } = useQuery<SelectMdxCompiledRelease, Error>({
    queryKey: ['release', slug],
    queryFn: async () => {
      const client = await getApiClient()
      const release = await Effect.runPromise(
        client.release
          .getReleaseBySlug({ params: { slug } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'release.getReleaseBySlug' })
            )
          )
      )
      return {
        ...release,
        bannerImageUrl: null,
        createdAt: new Date(release.createdAt),
        updatedAt: new Date(release.updatedAt),
        releaseDate: release.releaseDate ? new Date(release.releaseDate) : null,
        tags: release.tags ? [...release.tags] : null,
        streamingLinks: release.streamingLinks ? [...release.streamingLinks] : null
      }
    },
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

export type FavoriteShow = {
  id: string
  title: string
  slug: string
  thumbnailUrl: string | null
}

export type Favorite = {
  id: string
  userId: string
  audioId: string | null
  showId: string | null
  createdAt: string
  audio: FavoriteAudio | null
  // Real field on the ported /api/favorites response (GetFavoritesResponse
  // in packages/api/src/favorites.ts) -- was silently absent from this
  // type under the old fetcher-based hook. No current consumer reads it
  // (FavoritesSection.tsx filters to audio-only favorites), so this
  // doesn't change any UI behavior, just makes the type honest.
  show: FavoriteShow | null
}

export type FavoritesResponse = {
  success: boolean
  favorites: Favorite[]
  total: number
}

export function useFavorites() {
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
  const { data, error, isPending, refetch } = useQuery<FavoritesResponse, Error>({
    queryKey: favoritesQueryKey(),
    queryFn: async () => {
      const client = await getApiClient()
      const result = await Effect.runPromise(
        client.favorites
          .getFavorites({ query: {} })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'favorites.getFavorites' })
            )
          )
      )
      return {
        ...result,
        favorites: result.favorites.map((favorite) => ({ ...favorite }))
      }
    },
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
    mutationFn: async ({ audioId }) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.favorites
          .addFavorite({ payload: { audioId } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'favorites.addFavorite' })
            )
          )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesQueryKey() })
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
    mutationFn: async ({ audioId }) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.favorites
          .removeFavorite({ params: { audioId } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'favorites.removeFavorite' })
            )
          )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesQueryKey() })
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
    mutationFn: async ({ showId }) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.favorites
          .addFavorite({ payload: { showId } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'favorites.addFavorite' })
            )
          )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesQueryKey() })
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
    mutationFn: async ({ showId }) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.favorites
          .removeShowFavorite({ params: { showId } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'favorites.removeShowFavorite' })
            )
          )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesQueryKey() })
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

export function useAllShows({ limit = DEFAULT_PAGE_SIZE }: PaginationOptions = {}) {
  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery<PaginatedResponse<ShowWithHosts>, Error>({
      queryKey: ['shows', limit],
      queryFn: async ({ pageParam = 0 }) => {
        const client = await getApiClient()
        const result = await Effect.runPromise(
          client.shows
            .getAllShows({ query: { limit, offset: Number(pageParam) } })
            .pipe(
              Effect.tapError((error) => captureException(error, { endpoint: 'shows.getAllShows' }))
            )
        )
        return {
          data: result.data.map((show) => ({
            ...show,
            createdAt: new Date(show.createdAt),
            updatedAt: new Date(show.updatedAt),
            tags: show.tags ? [...show.tags] : null,
            hosts: [...show.hosts]
          })),
          pagination: result.pagination
        }
      },
      initialPageParam: 0,
      getNextPageParam: getNextOffsetPageParam
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
    queryFn: async () => {
      const client = await getApiClient()
      const show = await Effect.runPromise(
        client.shows
          .getShowBySlug({ params: { slug } })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'shows.getShowBySlug' }))
          )
      )
      return {
        ...show,
        createdAt: new Date(show.createdAt),
        updatedAt: new Date(show.updatedAt),
        tags: show.tags ? [...show.tags] : null,
        hosts: show.hosts ? [...show.hosts] : undefined
      }
    },
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

// Fetches up to 100 shows and finds by id client-side -- there is no
// get-show-by-id endpoint server-side (only getShowBySlug), so this
// inefficiency predates this port and isn't fixable from the client
// alone. Flagged in step 6b's process notes as a candidate for a real
// backend endpoint, not fixed here.
export function useShowById(id: string | null | undefined) {
  const { data, error, isPending } = useQuery<ShowBasicInfo, Error>({
    queryKey: ['show-by-id', id],
    queryFn: async () => {
      const client = await getApiClient()
      const result = await Effect.runPromise(
        client.shows
          .getAllShows({ query: { limit: 100, offset: 0 } })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'shows.getAllShows' }))
          )
      )
      const show = result.data.find((s) => s.id === id)
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
  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery<PaginatedResponse<SelectAudio>, Error>({
      queryKey: ['show-episodes', slug, limit],
      queryFn: async ({ pageParam = 0 }) => {
        const client = await getApiClient()
        const result = await Effect.runPromise(
          client.shows
            .getShowEpisodes({ params: { slug }, query: { limit, offset: Number(pageParam) } })
            .pipe(
              Effect.tapError((error) =>
                captureException(error, { endpoint: 'shows.getShowEpisodes' })
              )
            )
        )
        return {
          data: result.data.map((episode) => ({
            ...episode,
            createdAt: new Date(episode.createdAt),
            updatedAt: new Date(episode.updatedAt),
            tags: episode.tags ? [...episode.tags] : null
          })),
          pagination: result.pagination
        }
      },
      initialPageParam: 0,
      getNextPageParam: getNextOffsetPageParam,
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
    { data: SubscriptionWithShow[]; pagination: unknown },
    Error
  >({
    queryKey: userSubscriptionsQueryKey(),
    queryFn: async () => {
      const client = await getApiClient()
      const result = await Effect.runPromise(
        client.user
          .getUserSubscriptions({ query: {} })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'user.getUserSubscriptions' })
            )
          )
      )
      return {
        data: result.data.map((s) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          show: {
            ...s.show,
            tags: s.show.tags ? [...s.show.tags] : null,
            createdAt: new Date(s.show.createdAt),
            updatedAt: new Date(s.show.updatedAt)
          }
        })),
        pagination: result.pagination
      }
    },
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
    mutationFn: async ({ showId }) => {
      const client = await getApiClient()
      const result = await Effect.runPromise(
        client.shows
          .subscribeToShow({ params: { id: showId } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'shows.subscribeToShow' })
            )
          )
      )
      return { ...result, createdAt: new Date(result.createdAt) }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userSubscriptionsQueryKey() })
    }
  })

  return {
    subscribe,
    isPending
  }
}

export function useUnsubscribeFromShow() {
  const queryClient = useQueryClient()
  const { mutateAsync: unsubscribe, isPending } = useMutation<void, Error, { showId: string }>({
    mutationFn: async ({ showId }) => {
      const client = await getApiClient()
      await Effect.runPromise(
        client.shows
          .unsubscribeFromShow({ params: { id: showId } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'shows.unsubscribeFromShow' })
            )
          )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userSubscriptionsQueryKey() })
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
  socialLinks: ReadonlyArray<SocialLink>
  createdAt: string
  content: {
    mixes: ReadonlyArray<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
      type: 'mix' | 'track' | 'misc'
      showId: string | null
    }>
    shows: ReadonlyArray<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
    }>
    editorials: ReadonlyArray<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
      description: string | null
      createdAt: string
    }>
    tweets: ReadonlyArray<{
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
    tags: ReadonlyArray<string> | null
    createdAt: string
    compiledContent: string | null
    hosts: ReadonlyArray<{ id: string; name: string; username: string | null }>
  }
}

export type ResolveResult = ResolvedProfile | ResolvedShow

export function useResolveSlug(slug: string) {
  const { data, error, isPending } = useQuery<ResolveResult, Error>({
    queryKey: ['resolve', slug],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.resolve
          .resolveSlug({ params: { slug } })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'resolve.resolveSlug' }))
          )
      )
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
    queryFn: async () => {
      const client = await getApiClient()
      const djs = await Effect.runPromise(
        client.user
          .listDjs({})
          .pipe(Effect.tapError((error) => captureException(error, { endpoint: 'user.listDjs' })))
      )
      return djs.map((dj) => ({ ...dj }))
    },
    staleTime: 1000 * 60 * 5
  })
}

export function usePublicProfile(username: string) {
  const { data, error, isPending } = useQuery<PublicProfile, Error>({
    queryKey: ['profile', username],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.profile
          .getPublicProfile({ params: { username } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'profile.getPublicProfile' })
            )
          )
      )
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

export function useSendMixNotification() {
  return useMutation<SendMixNotificationResponse, Error, SendMixNotificationInput>({
    mutationFn: async (payload) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.email
          .sendMixNotification({ payload })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'email.sendMixNotification' })
            )
          )
      )
    }
  })
}

type NewsletterSubscribeResponse = {
  subscribed: boolean
  email: string
}

export function useNewsletterSubscribe() {
  return useMutation<NewsletterSubscribeResponse, Error, { email: string; name?: string }>({
    mutationFn: async ({ email, name }) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.newsletter
          .subscribe({ payload: { email, name, source: 'subscribe_page' } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'newsletter.subscribe' })
            )
          )
      )
    }
  })
}

export function useNewsletterUnsubscribe() {
  return useMutation<{ success: boolean }, Error, { token: string }>({
    mutationFn: async ({ token }) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.newsletter
          .unsubscribe({ payload: { token } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'newsletter.unsubscribe' })
            )
          )
      )
    }
  })
}

export function useRequestNewsletterUnsubscribe() {
  return useMutation<{ sent: boolean }, Error, { email: string }>({
    mutationFn: async ({ email }) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.newsletter
          .requestUnsubscribe({ payload: { email } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'newsletter.requestUnsubscribe' })
            )
          )
      )
    }
  })
}

type QRPdfResponse = {
  url: string
  cached: boolean
}

export function useMixQRPdf(slug: string, enabled = false) {
  return useQuery<QRPdfResponse>({
    queryKey: ['mix-qr-pdf', slug],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.audio
          .getMixQRPdf({ params: { slug }, query: {} })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'audio.getMixQRPdf' }))
          )
      )
    },
    enabled,
    staleTime: 1000 * 60 * 60 * 24
  })
}

export function useShowQRPdf(slug: string, enabled = false) {
  return useQuery<QRPdfResponse>({
    queryKey: ['show-qr-pdf', slug],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.shows
          .getShowQRPdf({ params: { slug }, query: {} })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'shows.getShowQRPdf' }))
          )
      )
    },
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

export interface MusicLabel {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  bannerImageUrl: string | null
  slug: string
  content: string
  tags: string[] | null
  genres: string[] | null
  publishedAt: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  compiledContent?: string
  creators?: Array<{ id: string; name: string }>
  affiliatedArtists?: MusicArtist[]
  affiliatedAlbums?: MusicAlbum[]
}

type MusicArtistInput = Omit<MusicArtist, 'genres'> & {
  readonly genres: ReadonlyArray<string> | null
}

type MusicAlbumInput = Omit<MusicAlbum, 'artistNames' | 'genres'> & {
  readonly artistNames: ReadonlyArray<string> | null
  readonly genres: ReadonlyArray<string> | null
}

const mapMusicArtist = (artist: MusicArtistInput): MusicArtist => ({
  ...artist,
  genres: artist.genres ? [...artist.genres] : null
})

const mapMusicAlbum = (album: MusicAlbumInput): MusicAlbum => ({
  ...album,
  artistNames: album.artistNames ? [...album.artistNames] : null,
  genres: album.genres ? [...album.genres] : null
})

const mapMusicLabel = (label: LabelResponse): MusicLabel => ({
  ...label,
  tags: label.tags ? [...label.tags] : null,
  genres: label.genres ? [...label.genres] : null,
  creators: label.creators ? [...label.creators] : undefined,
  affiliatedArtists: label.affiliatedArtists
    ? label.affiliatedArtists.map(mapMusicArtist)
    : undefined,
  affiliatedAlbums: label.affiliatedAlbums ? label.affiliatedAlbums.map(mapMusicAlbum) : undefined
})

export function useLabels() {
  return useQuery<MusicLabel[]>({
    queryKey: ['labels'],
    queryFn: async () => {
      const client = await getApiClient()
      const labels = await Effect.runPromise(
        client.music
          .listLabels({})
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'music.listLabels' }))
          )
      )
      return labels.map(mapMusicLabel)
    }
  })
}

export function useLabelBySlug(slug: string) {
  return useQuery<MusicLabel>({
    queryKey: ['label', slug],
    queryFn: async () => {
      const client = await getApiClient()
      const label = await Effect.runPromise(
        client.music
          .getLabelBySlug({ params: { slug } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'music.getLabelBySlug' })
            )
          )
      )
      return mapMusicLabel(label)
    },
    enabled: Boolean(slug)
  })
}

export function useAdminLabels() {
  return useQuery<MusicLabel[]>({
    queryKey: ['admin', 'labels'],
    queryFn: async () => {
      const client = await getApiClient()
      const labels = await Effect.runPromise(
        client.music
          .listLabelsForAdmin({})
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'music.listLabelsForAdmin' })
            )
          )
      )
      return labels.map(mapMusicLabel)
    }
  })
}

export function useCreateAdminLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; slug: string; content: string }) => {
      const client = await getApiClient()
      return mapMusicLabel(await Effect.runPromise(client.music.createLabel({ payload: data })))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'labels'] })
  })
}

export function useAdminLabel(id: string) {
  return useQuery<MusicLabel>({
    queryKey: ['admin', 'labels', id],
    queryFn: async () => {
      const client = await getApiClient()
      return mapMusicLabel(await Effect.runPromise(client.music.getLabel({ params: { id } })))
    },
    enabled: Boolean(id)
  })
}

export function useUpdateAdminLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateLabelInput }) => {
      const client = await getApiClient()
      return mapMusicLabel(
        await Effect.runPromise(client.music.updateLabel({ params: { id }, payload: data }))
      )
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'labels', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'labels'] })
      qc.invalidateQueries({ queryKey: ['labels'] })
    }
  })
}

export function useDeleteAdminLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const client = await getApiClient()
      await Effect.runPromise(client.music.deleteLabel({ params: { id } }))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'labels'] })
      qc.invalidateQueries({ queryKey: ['admin', 'affiliations'] })
      qc.invalidateQueries({ queryKey: ['labels'] })
    }
  })
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
  metadata: EntityLinkResponse['metadata']
  createdAt: string
  updatedAt: string
}

export function useAdminArtists() {
  return useQuery<MusicArtist[]>({
    queryKey: ['admin', 'artists'],
    queryFn: async () => {
      const client = await getApiClient()
      const artists = await Effect.runPromise(
        client.music
          .listArtists({})
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'music.listArtists' }))
          )
      )
      return artists.map(mapMusicArtist)
    }
  })
}

export function useAdminArtist(id: string) {
  return useQuery<MusicArtist>({
    queryKey: ['admin', 'artists', id],
    queryFn: async () => {
      const client = await getApiClient()
      const artist = await Effect.runPromise(
        client.music
          .getArtist({ params: { id } })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'music.getArtist' }))
          )
      )
      return mapMusicArtist(artist)
    },
    enabled: Boolean(id)
  })
}

export function useUpdateAdminArtist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateArtistInput }) => {
      const client = await getApiClient()
      const artist = await Effect.runPromise(
        client.music
          .updateArtist({ params: { id }, payload: data })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'music.updateArtist' }))
          )
      )
      return mapMusicArtist(artist)
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'artists', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'artists'] })
    }
  })
}

export function useDeleteAdminArtist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const client = await getApiClient()
      await Effect.runPromise(
        client.music
          .deleteArtist({ params: { id } })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'music.deleteArtist' }))
          )
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'artists'] })
      qc.invalidateQueries({ queryKey: ['admin', 'affiliations'] })
    }
  })
}

export function useAdminAlbums() {
  return useQuery<MusicAlbum[]>({
    queryKey: ['admin', 'albums'],
    queryFn: () => fetcher(apiUrl('/music/albums'))
  })
}

export function useAdminAlbum(id: string) {
  return useQuery<MusicAlbum>({
    queryKey: ['admin', 'albums', id],
    queryFn: () => fetcher(apiUrl(`/music/albums/${id}`)),
    enabled: Boolean(id)
  })
}

export function useUpdateAdminAlbum() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAlbumInput }) =>
      fetcher<MusicAlbum>(apiUrl(`/music/albums/${id}`), {
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
    mutationFn: (id: string) => fetcher(apiUrl(`/music/albums/${id}`), { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'albums'] })
      qc.invalidateQueries({ queryKey: ['admin', 'affiliations'] })
    }
  })
}

const affiliationQueryKey = (
  entityType: 'label' | 'artist' | 'album',
  id: string,
  target: string
) => ['admin', 'affiliations', entityType, id, target] as const

export function useLabelArtists(labelId: string) {
  return useQuery<MusicArtist[]>({
    queryKey: affiliationQueryKey('label', labelId, 'artists'),
    queryFn: async () =>
      (await fetcher<MusicArtist[]>(apiUrl(`/music/labels/${labelId}/artists`))).map(
        mapMusicArtist
      ),
    enabled: Boolean(labelId)
  })
}

export function useLabelAlbums(labelId: string) {
  return useQuery<MusicAlbum[]>({
    queryKey: affiliationQueryKey('label', labelId, 'albums'),
    queryFn: async () =>
      (await fetcher<MusicAlbum[]>(apiUrl(`/music/labels/${labelId}/albums`))).map(mapMusicAlbum),
    enabled: Boolean(labelId)
  })
}

export function useArtistLabels(artistId: string) {
  return useQuery<MusicLabel[]>({
    queryKey: affiliationQueryKey('artist', artistId, 'labels'),
    queryFn: async () =>
      (await fetcher<LabelResponse[]>(apiUrl(`/music/artists/${artistId}/labels`))).map(
        mapMusicLabel
      ),
    enabled: Boolean(artistId)
  })
}

export function useAlbumLabels(albumId: string) {
  return useQuery<MusicLabel[]>({
    queryKey: affiliationQueryKey('album', albumId, 'labels'),
    queryFn: async () =>
      (await fetcher<LabelResponse[]>(apiUrl(`/music/albums/${albumId}/labels`))).map(
        mapMusicLabel
      ),
    enabled: Boolean(albumId)
  })
}

const invalidateArtistAffiliations = (
  queryClient: ReturnType<typeof useQueryClient>,
  labelId: string,
  artistId: string
) => {
  queryClient.invalidateQueries({ queryKey: affiliationQueryKey('label', labelId, 'artists') })
  queryClient.invalidateQueries({ queryKey: affiliationQueryKey('artist', artistId, 'labels') })
  queryClient.invalidateQueries({ queryKey: ['label'] })
}

const invalidateAlbumAffiliations = (
  queryClient: ReturnType<typeof useQueryClient>,
  labelId: string,
  albumId: string
) => {
  queryClient.invalidateQueries({ queryKey: affiliationQueryKey('label', labelId, 'albums') })
  queryClient.invalidateQueries({ queryKey: affiliationQueryKey('album', albumId, 'labels') })
  queryClient.invalidateQueries({ queryKey: ['label'] })
}

export function useAffiliateArtistWithLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ labelId, artistId }: { labelId: string; artistId: string }) =>
      fetcher(apiUrl(`/music/labels/${labelId}/artists/${artistId}`), { method: 'PUT' }),
    onSuccess: (_, { labelId, artistId }) =>
      invalidateArtistAffiliations(queryClient, labelId, artistId)
  })
}

export function useUnaffiliateArtistFromLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ labelId, artistId }: { labelId: string; artistId: string }) =>
      fetcher(apiUrl(`/music/labels/${labelId}/artists/${artistId}`), { method: 'DELETE' }),
    onSuccess: (_, { labelId, artistId }) =>
      invalidateArtistAffiliations(queryClient, labelId, artistId)
  })
}

export function useAffiliateAlbumWithLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ labelId, albumId }: { labelId: string; albumId: string }) =>
      fetcher(apiUrl(`/music/labels/${labelId}/albums/${albumId}`), { method: 'PUT' }),
    onSuccess: (_, { labelId, albumId }) =>
      invalidateAlbumAffiliations(queryClient, labelId, albumId)
  })
}

export function useUnaffiliateAlbumFromLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ labelId, albumId }: { labelId: string; albumId: string }) =>
      fetcher(apiUrl(`/music/labels/${labelId}/albums/${albumId}`), { method: 'DELETE' }),
    onSuccess: (_, { labelId, albumId }) =>
      invalidateAlbumAffiliations(queryClient, labelId, albumId)
  })
}

export function useAdminTracks() {
  return useQuery<MusicTrack[]>({
    queryKey: ['admin', 'tracks'],
    queryFn: () => fetcher(apiUrl('/music/tracks'))
  })
}

export function useAdminTrack(id: string) {
  return useQuery<MusicTrack>({
    queryKey: ['admin', 'tracks', id],
    queryFn: () => fetcher(apiUrl(`/music/tracks/${id}`)),
    enabled: Boolean(id)
  })
}

export function useUpdateAdminTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTrackInput }) =>
      fetcher<MusicTrack>(apiUrl(`/music/tracks/${id}`), {
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
    mutationFn: (id: string) => fetcher(apiUrl(`/music/tracks/${id}`), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tracks'] })
  })
}

export function useAdminEntityLinks(entityType: string, entityId: string, enabled = true) {
  return useQuery<AdminMusicEntityLink[]>({
    queryKey: ['admin', 'links', entityType, entityId],
    queryFn: () => fetcher(apiUrl(`/music/${entityType}/${entityId}/links`)),
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
      url,
      status
    }: {
      entityType: string
      entityId: string
      platform: string
      url: string
      status?: LinkStatus
    }) =>
      fetcher<AdminMusicEntityLink>(apiUrl(`/music/${entityType}/${entityId}/links`), {
        method: 'POST',
        body: JSON.stringify({ platform, url, status })
      }),
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
      fetcher<AdminMusicEntityLink>(apiUrl(`/music/${entityType}/${entityId}/links/${linkId}`), {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }),
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
      fetcher(apiUrl(`/music/${entityType}/${entityId}/links/${linkId}`), {
        method: 'DELETE'
      }),
    onSuccess: (_, { entityType, entityId }) =>
      qc.invalidateQueries({
        queryKey: ['admin', 'links', entityType, entityId]
      })
  })
}

export function useAdminRescrapeEntityLinks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      entityType,
      entityId
    }: {
      entityType: 'album' | 'track' | 'playlist'
      entityId: string
    }) =>
      fetcher<{ links: AdminMusicEntityLink[] }>(
        apiUrl(`/music/${entityType}/${entityId}/links/rescrape`),
        { method: 'POST' }
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
    mutationFn: async ({
      albumId,
      artistId,
      role
    }: {
      albumId: string
      artistId: string
      role?: string
    }) => {
      const client = await getApiClient()
      await Effect.runPromise(
        client.music
          .addArtistToAlbum({ params: { albumId, artistId }, payload: { role } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'music.addArtistToAlbum' })
            )
          )
      )
    },
    onSuccess: (_, { albumId }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'links', 'album', albumId] })
  })
}

export function useRemoveArtistFromAlbum() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ albumId, artistId }: { albumId: string; artistId: string }) => {
      const client = await getApiClient()
      await Effect.runPromise(
        client.music
          .removeArtistFromAlbum({ params: { albumId, artistId } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'music.removeArtistFromAlbum' })
            )
          )
      )
    },
    onSuccess: (_, { albumId }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'links', 'album', albumId] })
  })
}

export function useAddArtistToTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      trackId,
      artistId,
      role
    }: {
      trackId: string
      artistId: string
      role?: string
    }) => {
      const client = await getApiClient()
      await Effect.runPromise(
        client.music
          .addArtistToTrack({ params: { trackId, artistId }, payload: { role } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'music.addArtistToTrack' })
            )
          )
      )
    },
    onSuccess: (_, { trackId }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'links', 'track', trackId] })
  })
}

export function useRemoveArtistFromTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ trackId, artistId }: { trackId: string; artistId: string }) => {
      const client = await getApiClient()
      await Effect.runPromise(
        client.music
          .removeArtistFromTrack({ params: { trackId, artistId } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'music.removeArtistFromTrack' })
            )
          )
      )
    },
    onSuccess: (_, { trackId }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'links', 'track', trackId] })
  })
}

const musicRemindersQueryKey = () => ['reminders'] as const

export function useMusicReminders() {
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
  return useQuery({
    queryKey: musicRemindersQueryKey(),
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client['music-reminders']
          .getMusicReminders({})
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'music-reminders.getMusicReminders' })
            )
          )
      )
    },
    enabled: isAuthenticated
  })
}

export function useCreateMusicReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateMusicReminderInput) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client['music-reminders']
          .createMusicReminder({ payload })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'music-reminders.createMusicReminder' })
            )
          )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: musicRemindersQueryKey() })
    }
  })
}

export function useDeleteMusicReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client['music-reminders']
          .deleteMusicReminder({ params: { id } })
          .pipe(
            Effect.tapError((error) =>
              captureException(error, { endpoint: 'music-reminders.deleteMusicReminder' })
            )
          )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: musicRemindersQueryKey() })
    }
  })
}
