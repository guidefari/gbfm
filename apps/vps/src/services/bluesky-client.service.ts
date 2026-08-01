import { Context, Effect, Layer, Redacted } from 'effect'
import { z } from 'zod'
import { BlueskyProviderError, IdentityResolutionError } from '@/errors'

const handleSchema = z.string().trim().min(1).max(253)
const resolveHandleResponse = z.object({ did: z.string().min(1) })
const didDocument = z.object({
  service: z.array(
    z.object({
      id: z.string(),
      type: z.literal('AtprotoPersonalDataServer'),
      serviceEndpoint: z.string().url()
    })
  )
})
const sessionResponse = z.object({
  did: z.string().min(1),
  handle: z.string().min(1),
  accessJwt: z.string().min(1),
  refreshJwt: z.string().min(1)
})

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
    const normalizedHandle = handleSchema.safeParse(handle)
    if (!normalizedHandle.success) {
      return yield* new IdentityResolutionError({ message: 'Enter a valid Bluesky handle or DID' })
    }

    const resolved = yield* getJson(
      fetcher,
      `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(normalizedHandle.data)}`,
      'resolveIdentity'
    )
    const parsed = resolveHandleResponse.safeParse(resolved)
    if (!parsed.success) {
      return yield* new IdentityResolutionError({
        message: 'Bluesky did not return a valid identity'
      })
    }

    const didResponse = yield* Effect.tryPromise({
      try: async () => {
        const response = await fetcher(
          `https://plc.directory/${encodeURIComponent(parsed.data.did)}`,
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
    const document = didDocument.safeParse(didResponse)
    const service = document.success
      ? document.data.service.find((entry) => entry.id === '#atproto_pds')
      : undefined
    if (!service) {
      return yield* new IdentityResolutionError({ message: 'Bluesky identity has no PDS' })
    }

    return { did: parsed.data.did, serviceEndpoint: service.serviceEndpoint }
  })

export const makeBlueskyClient = (fetcher: Fetch = globalThis.fetch): BlueskyClient => ({
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
      const session = sessionResponse.safeParse(response)
      if (!session.success || session.data.did !== identity.did) {
        return yield* new IdentityResolutionError({
          message: 'Bluesky identity verification failed'
        })
      }

      return {
        did: session.data.did,
        handle: session.data.handle,
        serviceEndpoint: identity.serviceEndpoint,
        accessJwt: Redacted.make(session.data.accessJwt),
        refreshJwt: Redacted.make(session.data.refreshJwt)
      }
    })
})

export const BlueskyClientLayer = Layer.succeed(BlueskyClient, makeBlueskyClient())
