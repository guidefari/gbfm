import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query'
import { Effect, Schema } from 'effect'
import { HttpApiError } from 'effect/unstable/httpapi'
import { useSession } from '@/lib/auth-client'
import { captureException } from '@/services/analytics'

const TRACKING_PARAMETERS = new Set([
  'dclid',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'msclkid',
  'si'
])

const MusicEntityReferenceSchema = Schema.Struct({
  type: Schema.Literals(['album', 'track', 'playlist']),
  id: Schema.NonEmptyString
})

const ResolvedMusicEntityLinksSchema = Schema.Array(
  Schema.Struct({
    platform: Schema.String,
    url: Schema.String
  })
)

const ResolvedMusicEntitySchema = Schema.Struct({
  entityType: Schema.Literals(['album', 'track', 'playlist']),
  entity: Schema.Struct({
    id: Schema.NonEmptyString,
    title: Schema.String,
    slug: Schema.String,
    coverImageUrl: Schema.NullOr(Schema.String),
    artistNames: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
    description: Schema.optional(Schema.NullOr(Schema.String))
  }),
  links: ResolvedMusicEntityLinksSchema,
  coverImageUrl: Schema.NullOr(Schema.String)
})

const ResolvedArtistSchema = Schema.Struct({
  entityType: Schema.Literal('artist'),
  entity: Schema.Struct({
    id: Schema.NonEmptyString,
    name: Schema.String,
    slug: Schema.String,
    imageUrl: Schema.NullOr(Schema.String)
  }),
  links: ResolvedMusicEntityLinksSchema,
  coverImageUrl: Schema.NullOr(Schema.String)
})

const MusicResolutionResponseSchema = Schema.Union([
  ResolvedMusicEntitySchema,
  ResolvedArtistSchema
])

export type ResolvedMusicEntity = typeof ResolvedMusicEntitySchema.Type

export class MusicEntityResolutionFailed extends Schema.TaggedError<MusicEntityResolutionFailed>()(
  'MusicEntityResolutionFailed',
  { message: Schema.String }
) {}

export type AuthoringMusicResolutionOrigin = 'editorial' | 'tweet' | 'reply'

export type ResolveMusicEntityEffect = (
  url: string,
  origin: AuthoringMusicResolutionOrigin
) => Effect.Effect<ResolvedMusicEntity, MusicEntityResolutionFailed>

type MusicResolutionResponse = typeof MusicResolutionResponseSchema.Type

export const ensureEmbeddableMusicEntity = (resolved: MusicResolutionResponse) =>
  resolved.entityType === 'artist'
    ? Effect.fail(
        new MusicEntityResolutionFailed({
          message: 'Artist links cannot be attached to posts'
        })
      )
    : Effect.succeed(resolved)

const isDomain = (hostname: string, domain: string) =>
  hostname === domain || hostname.endsWith(`.${domain}`)

const providerCanonicalUrl = (url: URL): string | undefined => {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  const segments = url.pathname.split('/').filter(Boolean)

  if (isDomain(hostname, 'spotify.com')) {
    const prefix = segments[0]
    if (prefix === 'embed' || /^intl-[a-z]{2}$/i.test(prefix ?? '')) segments.shift()
    const [type, id, ...rest] = segments
    if (
      ['artist', 'album', 'track', 'playlist'].includes(type ?? '') &&
      id &&
      /^[A-Za-z0-9]+$/.test(id) &&
      rest.length === 0
    ) {
      return `https://open.spotify.com/${type}/${id}`
    }
  }

  if (isDomain(hostname, 'deezer.com')) {
    const typeIndex = segments.findIndex((segment) =>
      ['artist', 'album', 'track', 'playlist'].includes(segment)
    )
    const hasValidPrefix =
      typeIndex === 0 || (typeIndex === 1 && /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segments[0] ?? ''))
    const type = segments[typeIndex]
    const id = segments[typeIndex + 1]
    if (hasValidPrefix && type && id && /^\d+$/.test(id) && typeIndex + 2 === segments.length) {
      return `https://www.deezer.com/${type}/${id}`
    }
  }

  if (
    hostname === 'youtu.be' &&
    segments.length === 1 &&
    segments[0] &&
    /^[A-Za-z0-9_-]+$/.test(segments[0])
  ) {
    return `https://www.youtube.com/watch?v=${segments[0]}`
  }

  if (isDomain(hostname, 'youtube.com')) {
    const videoId =
      url.pathname === '/watch'
        ? url.searchParams.get('v')
        : segments.length === 2 && ['embed', 'shorts'].includes(segments[0] ?? '')
          ? segments[1]
          : undefined
    if (videoId && /^[A-Za-z0-9_-]+$/.test(videoId)) {
      return `https://www.youtube.com/watch?v=${videoId}`
    }

    const playlistId = url.pathname === '/playlist' ? url.searchParams.get('list') : undefined
    if (playlistId && /^[A-Za-z0-9_-]+$/.test(playlistId)) {
      return `https://www.youtube.com/playlist?list=${playlistId}`
    }
  }

  return undefined
}

export const canonicalMusicResolutionUrl = (source: string): string => {
  try {
    const url = new URL(source)
    const providerUrl = providerCanonicalUrl(url)
    if (providerUrl) return providerUrl

    url.hash = ''
    const trackingKeys = new Set<string>()
    url.searchParams.forEach((_value, key) => {
      const lowercaseKey = key.toLowerCase()
      if (lowercaseKey.startsWith('utm_') || TRACKING_PARAMETERS.has(lowercaseKey)) {
        trackingKeys.add(key)
      }
    })
    for (const key of trackingKeys) url.searchParams.delete(key)
    url.searchParams.sort()
    return url.toString()
  } catch {
    return source
  }
}

export const resolveMusicEntityEffect: ResolveMusicEntityEffect = (url, origin) =>
  Effect.gen(function* () {
    const { getApiClient } = yield* Effect.promise(() => import('./api-client'))
    const client = yield* Effect.promise(getApiClient)
    const response = yield* client.music.resolveMusicEntity({ payload: { url, origin } }).pipe(
      Effect.retry({
        times: 1,
        while: (error) => error instanceof HttpApiError.InternalServerError
      }),
      Effect.tapError((error) => captureException(error, { endpoint: 'music.resolveMusicEntity' }))
    )
    const resolved = yield* Schema.decodeUnknownEffect(MusicResolutionResponseSchema)(response)
    return yield* ensureEmbeddableMusicEntity(resolved)
  }).pipe(
    Effect.mapError(
      () => new MusicEntityResolutionFailed({ message: 'Could not resolve music link' })
    )
  )

export const musicEntityResolutionQueryOptions = (
  url: string,
  authorizationScope: string,
  origin: AuthoringMusicResolutionOrigin,
  resolve: ResolveMusicEntityEffect = resolveMusicEntityEffect
) =>
  queryOptions({
    queryKey: [
      'music-entity-resolution',
      authorizationScope,
      canonicalMusicResolutionUrl(url)
    ] as const,
    queryFn: () => Effect.runPromise(resolve(url, origin)),
    retry: false,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000
  })

export const resolveMusicEntityWithCache = (
  queryClient: QueryClient,
  url: string,
  authorizationScope: string,
  origin: AuthoringMusicResolutionOrigin,
  resolve: ResolveMusicEntityEffect = resolveMusicEntityEffect
): Promise<ResolvedMusicEntity> =>
  queryClient.fetchQuery(
    musicEntityResolutionQueryOptions(url, authorizationScope, origin, resolve)
  )

export const resolveMusicEntityReferenceWithCacheEffect = (
  queryClient: QueryClient,
  url: string,
  authorizationScope: string,
  origin: AuthoringMusicResolutionOrigin
) =>
  Effect.tryPromise({
    try: () => resolveMusicEntityWithCache(queryClient, url, authorizationScope, origin),
    catch: () => new MusicEntityResolutionFailed({ message: 'Could not resolve music link' })
  }).pipe(
    Effect.flatMap((resolved) =>
      Schema.decodeUnknownEffect(MusicEntityReferenceSchema)({
        type: resolved.entityType,
        id: resolved.entity.id
      })
    ),
    Effect.mapError(
      () => new MusicEntityResolutionFailed({ message: 'Could not resolve music link' })
    )
  )

export function useResolveMusicEntity(url: string, origin: AuthoringMusicResolutionOrigin) {
  const { data: session, isPending } = useSession()
  const authorizationScope = session?.user
    ? `${session.user.id}:${session.user.role ?? 'user'}`
    : 'anonymous'
  const query = useQuery({
    ...musicEntityResolutionQueryOptions(url, authorizationScope, origin),
    enabled: !isPending && Boolean(url) && url.length > 10
  })

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch
  }
}
