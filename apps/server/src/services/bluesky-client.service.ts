import { Context, Effect, Layer, Option, Redacted, Schema } from 'effect'
import { BlueskyProviderError, IdentityResolutionError } from '@/errors'

const Handle = Schema.NonEmptyString.pipe(Schema.check(Schema.isMaxLength(253)))
const ResolveHandleResponse = Schema.Struct({ did: Schema.NonEmptyString })
const DidDocument = Schema.Struct({
  service: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      type: Schema.Literal('AtprotoPersonalDataServer'),
      serviceEndpoint: Schema.NonEmptyString
    })
  )
})
const AuthorFeedResponse = Schema.Struct({
  feed: Schema.Array(Schema.Unknown),
  cursor: Schema.optional(Schema.String)
})
const SessionResponse = Schema.Struct({
  did: Schema.NonEmptyString,
  handle: Schema.NonEmptyString,
  accessJwt: Schema.NonEmptyString,
  refreshJwt: Schema.NonEmptyString
})

const decodeHandle = Schema.decodeUnknownOption(Handle)
const decodeResolveHandle = Schema.decodeUnknownOption(ResolveHandleResponse)
const decodeDidDocument = Schema.decodeUnknownOption(DidDocument)
const decodeAuthorFeed = Schema.decodeUnknownOption(AuthorFeedResponse)
const decodeSession = Schema.decodeUnknownOption(SessionResponse)

const isAbsoluteUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol.startsWith('http')
  } catch {
    return false
  }
}

export type BlueskyLogin = {
  readonly did: string
  readonly handle: string
  readonly serviceEndpoint: string
  readonly accessJwt: Redacted.Redacted<string>
  readonly refreshJwt: Redacted.Redacted<string>
}

export interface BlueskyClient {
  readonly login: (input: {
    readonly handle: string
    readonly appPassword: Redacted.Redacted<string>
  }) => Effect.Effect<BlueskyLogin, BlueskyProviderError | IdentityResolutionError>
  readonly refreshSession: (input: {
    readonly serviceEndpoint: string
    readonly refreshJwt: Redacted.Redacted<string>
    readonly expectedDid: string
  }) => Effect.Effect<BlueskyLogin, BlueskyProviderError | IdentityResolutionError>
  readonly getAuthorFeed: (input: {
    readonly serviceEndpoint: string
    readonly actorDid: string
    readonly accessJwt: Redacted.Redacted<string>
    readonly cursor?: string
  }) => Effect.Effect<
    { readonly entries: ReadonlyArray<unknown>; readonly cursor: string | undefined },
    BlueskyProviderError
  >
}

export const BlueskyClient = Context.Service<BlueskyClient>('BlueskyClient')

type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>

const providerError = (operation: BlueskyProviderError['operation'], message: string) =>
  new BlueskyProviderError({ operation, message })

const getJson = (fetcher: Fetch, url: string, operation: BlueskyProviderError['operation']) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetcher(url, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok)
        throw providerError(operation, `Bluesky request failed (${response.status})`)
      const payload: unknown = await response.json()
      return payload
    },
    catch: (error) =>
      error instanceof BlueskyProviderError
        ? error
        : providerError(operation, 'Bluesky request failed')
  })

const resolveIdentity = (fetcher: Fetch, handle: string) =>
  Effect.gen(function* () {
    const normalizedHandle = decodeHandle(handle.trim())
    if (Option.isNone(normalizedHandle)) {
      return yield* new IdentityResolutionError({ message: 'Enter a valid Bluesky handle or DID' })
    }

    const resolved = yield* getJson(
      fetcher,
      `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(normalizedHandle.value)}`,
      'resolveIdentity'
    )
    const parsed = decodeResolveHandle(resolved)
    if (Option.isNone(parsed)) {
      return yield* new IdentityResolutionError({
        message: 'Bluesky did not return a valid identity'
      })
    }

    const didResponse = yield* Effect.tryPromise({
      try: async () => {
        const response = await fetcher(
          `https://plc.directory/${encodeURIComponent(parsed.value.did)}`,
          {
            signal: AbortSignal.timeout(10_000)
          }
        )
        if (!response.ok) throw new Error('DID document unavailable')
        const payload: unknown = await response.json()
        return payload
      },
      catch: () => new IdentityResolutionError({ message: 'Unable to resolve Bluesky service' })
    })
    const document = decodeDidDocument(didResponse)
    const service = Option.isSome(document)
      ? document.value.service.find(
          (entry) => entry.id === '#atproto_pds' && isAbsoluteUrl(entry.serviceEndpoint)
        )
      : undefined
    if (!service) {
      return yield* new IdentityResolutionError({ message: 'Bluesky identity has no PDS' })
    }

    return { did: parsed.value.did, serviceEndpoint: service.serviceEndpoint }
  })

export const makeBlueskyClient = (fetcher: Fetch = globalThis.fetch): BlueskyClient => ({
  refreshSession: ({ serviceEndpoint, refreshJwt, expectedDid }) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetcher(
          `${serviceEndpoint}/xrpc/com.atproto.server.refreshSession`,
          {
            method: 'POST',
            headers: { authorization: `Bearer ${Redacted.value(refreshJwt)}` },
            signal: AbortSignal.timeout(10_000)
          }
        )
        if (!response.ok) throw providerError('refresh', 'Bluesky session refresh failed')
        const payload: unknown = await response.json()
        const session = decodeSession(payload)
        if (Option.isNone(session) || session.value.did !== expectedDid) {
          throw new IdentityResolutionError({ message: 'Bluesky identity verification failed' })
        }
        return {
          did: session.value.did,
          handle: session.value.handle,
          serviceEndpoint,
          accessJwt: Redacted.make(session.value.accessJwt),
          refreshJwt: Redacted.make(session.value.refreshJwt)
        }
      },
      catch: (error) =>
        error instanceof BlueskyProviderError || error instanceof IdentityResolutionError
          ? error
          : providerError('refresh', 'Bluesky session refresh failed')
    }),
  getAuthorFeed: ({ serviceEndpoint, actorDid, accessJwt, cursor }) =>
    Effect.tryPromise({
      try: async () => {
        const url = new URL(`${serviceEndpoint}/xrpc/app.bsky.feed.getAuthorFeed`)
        url.searchParams.set('actor', actorDid)
        url.searchParams.set('filter', 'posts_and_author_threads')
        url.searchParams.set('limit', '100')
        if (cursor) url.searchParams.set('cursor', cursor)
        const response = await fetcher(url, {
          headers: { authorization: `Bearer ${Redacted.value(accessJwt)}` },
          signal: AbortSignal.timeout(10_000)
        })
        if (!response.ok) throw providerError('feed', 'Unable to read Bluesky archive')
        const payload: unknown = await response.json()
        const parsed = decodeAuthorFeed(payload)
        if (Option.isNone(parsed)) throw providerError('feed', 'Bluesky returned an invalid feed')
        return { entries: parsed.value.feed, cursor: parsed.value.cursor }
      },
      catch: (error) =>
        error instanceof BlueskyProviderError
          ? error
          : providerError('feed', 'Unable to read Bluesky archive')
    }),
  login: ({ handle, appPassword }) =>
    Effect.gen(function* () {
      const identity = yield* resolveIdentity(fetcher, handle)
      const response = yield* Effect.tryPromise({
        try: async () => {
          const result = await fetcher(
            `${identity.serviceEndpoint}/xrpc/com.atproto.server.createSession`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ identifier: handle, password: Redacted.value(appPassword) }),
              signal: AbortSignal.timeout(10_000)
            }
          )
          if (!result.ok) throw providerError('login', 'Bluesky rejected the app password')
          const payload: unknown = await result.json()
          return payload
        },
        catch: (error) =>
          error instanceof BlueskyProviderError
            ? error
            : providerError('login', 'Unable to connect to Bluesky')
      })
      const session = decodeSession(response)
      if (Option.isNone(session) || session.value.did !== identity.did) {
        return yield* new IdentityResolutionError({
          message: 'Bluesky identity verification failed'
        })
      }

      return {
        did: session.value.did,
        handle: session.value.handle,
        serviceEndpoint: identity.serviceEndpoint,
        accessJwt: Redacted.make(session.value.accessJwt),
        refreshJwt: Redacted.make(session.value.refreshJwt)
      }
    })
})

export const BlueskyClientLayer = Layer.succeed(BlueskyClient, makeBlueskyClient())
