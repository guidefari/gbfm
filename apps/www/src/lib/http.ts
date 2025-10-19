import type {
  SelectAudio,
  SelectLabel,
  SelectMdxCompiledAudio,
  SelectMdxCompiledLabel,
  SelectRelease,
  SelectMdxCompiledRelease
} from '@gbfm/vps/schemas'
import { useMutation, useQuery } from '@tanstack/react-query'
import { type User, useAuthStore } from '@/store/auth'
import type {
  AlbumApiResponse,
  PlaylistApiResponse,
  TrackAPIResponse
} from '@/types'

export const VPS_BASE_URL = import.meta.env.VITE_VPS_BASE_URL
export const AUTH_BASE_URL = `${VPS_BASE_URL}/auth`

type CustomRequestInit = RequestInit & {
  skipAuth?: boolean
  token?: string
}

export async function fetcher<T>(
  input: RequestInfo,
  init: CustomRequestInit = { skipAuth: true }
) {
  const { accessToken, refreshToken } = useAuthStore.getState()
  const jwt = init.token || accessToken

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(jwt
        ? {
            Authorization: `Bearer ${jwt}`,
            'Refresh-Token': refreshToken || ''
          }
        : {})
    }

    let res = await fetch(input, {
      ...init,
      headers
    })

    if (res.status === 401) {
      console.log('401, attempting to refresh token')
      const { refreshAccessToken } = useAuthStore.getState()
      const newToken = await refreshAccessToken()

      if (newToken) {
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${newToken}`
        }
        res = await fetch(input, {
          ...init,
          headers: retryHeaders
        })
      }
    }

    return res.json() as Promise<T>
  } catch (error) {
    console.error(error)
    throw error
  }
}

export function useAudioByType(type: 'mix' | 'track' | 'misc') {
  const { data, error, isPending } = useQuery<SelectAudio[], Error>({
    queryKey: ['audio', type],
    queryFn: async () =>
      fetcher<SelectAudio[]>(`${VPS_BASE_URL}/content/audio/${type}`)
  })

  return {
    data,
    error,
    isPending
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
        body: JSON.stringify({ id }),
        skipAuth: true
      }),
    staleTime: 15 * 60 * 1000
  })
  return {
    data: data,
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
  const { mutate: updateProfile, isPending } = useMutation<User, Error, User>({
    mutationFn: async (user) =>
      fetcher(`${VPS_BASE_URL}/auth/profile`, {
        method: 'PATCH',
        body: JSON.stringify(user)
      })
  })

  return {
    updateProfile,
    isPending
  }
}

export function useAllLabels() {
  const { data, error, isPending } = useQuery<SelectLabel[], Error>({
    queryKey: ['labels'],
    queryFn: async () =>
      fetcher<SelectLabel[]>(`${VPS_BASE_URL}/content/labels`)
  })

  return {
    data,
    error,
    isPending
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
  const { data, error, isPending } = useQuery<SelectRelease[], Error>({
    queryKey: ['releases', 'label', labelSlug],
    queryFn: async () =>
      fetcher<SelectRelease[]>(
        `${VPS_BASE_URL}/content/labels/${labelSlug}/releases`
      ),
    enabled: Boolean(labelSlug)
  })

  return {
    data,
    error,
    isPending
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
