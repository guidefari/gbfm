import type { D1Database } from '@cloudflare/workers-types'
import { eq } from 'drizzle-orm'
import { Clock, Effect, Layer, Schema } from 'effect'
import { describe, expect, test } from 'vitest'

import { session, user } from '@/db/auth.schema'
import { emailDeliveryLogsTable } from '@/db/email.schema'
import { Database, DatabaseLayer } from '@/db/layer'
import { ConfigService, createConfig, type WorkerConfigBindings } from '@/services/config.service'
import { EmailDeliveryLive } from '@/services/email-delivery.service'
import { EmailTransport, type OutboundEmailMessage } from '@/services/email-transport.service'
import { withTestLayer } from '@/test/effect'
import { createMigratedD1Database } from '@/test/migrate-d1'

import { Auth, AuthLive } from './auth'

const workerBindings = (): WorkerConfigBindings => ({
  APP_STAGE: 'test',
  USER_CONTENT_BUCKET_NAME: 'user-content',
  MIXES_BUCKET_NAME: 'mixes',
  EMAIL_SENDER: 'noreply@mail.goosebumps.fm',
  SpotifyClientId: 'configured',
  SpotifyClientSecret: 'configured',
  SENTRY_BACKEND_DSN: 'configured',
  VITE_PUBLIC_SENTRY_DSN: 'configured',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'configured',
  OTEL_EXPORTER_OTLP_HEADERS: 'configured',
  CloudflareAnalyticsApiToken: 'test-analytics-token',
  BETTER_AUTH_SECRET: 'configured',
  BETTER_AUTH_URL: 'http://localhost',
  StorageProvider: 'aws',
  StorageEndpoint: 'configured',
  StorageRegion: 'configured',
  StorageAccessKeyId: 'configured',
  StorageSecretAccessKey: 'configured',
  StorageSigningEndpoint: 'configured',
})

const makeDeferredTransport = () => {
  const messages: Array<OutboundEmailMessage> = []
  let resolveStarted: (() => void) | undefined
  let resolveDelivery: (() => void) | undefined

  const started = new Promise<void>((resolve) => {
    resolveStarted = resolve
  })

  const delivered = new Promise<void>((resolve) => {
    resolveDelivery = resolve
  })

  return {
    messages,
    started,
    release: () => {
      if (resolveDelivery === undefined) throw new Error('Email delivery did not start')
      resolveDelivery()
    },
    layer: Layer.succeed(EmailTransport, {
      send: (message) =>
        Effect.promise(async () => {
          messages.push(message)

          if (resolveStarted === undefined) throw new Error('Email delivery started more than once')
          resolveStarted()
          await delivered

          return { provider: 'cloudflare' as const, messageId: 'password-reset-receipt' }
        }),
    }),
  }
}

const authLayer = (
  d1: D1Database,
  transport: ReturnType<typeof makeDeferredTransport>['layer'],
) => {
  const database = DatabaseLayer(d1)
  const config = Layer.succeed(ConfigService, createConfig(workerBindings()))

  const clock = Layer.succeed(Clock.Clock, {
    currentTimeMillis: Effect.sync(Date.now),
    currentTimeMillisUnsafe: Date.now,
    currentTimeNanos: Effect.sync(() => BigInt(Date.now()) * 1_000_000n),
    currentTimeNanosUnsafe: () => BigInt(Date.now()) * 1_000_000n,
    monotonicTimeNanos: Effect.sync(() => BigInt(Date.now()) * 1_000_000n),
    monotonicTimeNanosUnsafe: () => BigInt(Date.now()) * 1_000_000n,
    sleep: () => Effect.void,
  })

  const delivery = EmailDeliveryLive.pipe(
    Layer.provide(Layer.mergeAll(database, config, transport, clock)),
  )

  return AuthLive.pipe(Layer.provide(Layer.mergeAll(database, config, delivery, clock)))
}

describe('AuthLive password-reset delivery', () => {
  test('awaits the Better Auth reset callback until delivery persists its receipt', async () => {
    await using d1Resource = await createMigratedD1Database()
    const d1 = d1Resource.database
    const database = Effect.runSync(withTestLayer(Database, DatabaseLayer(d1)))
    const transport = makeDeferredTransport()
    const auth = await Effect.runPromise(withTestLayer(Auth, authLayer(d1, transport.layer)))

    await database.insert(user).values({
      id: crypto.randomUUID(),
      name: 'Reset listener',
      email: 'reset-listener@example.com',
    })

    const response = auth.handler(
      new Request('http://localhost/auth/request-password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          email: 'reset-listener@example.com',
          redirectTo: 'http://localhost/reset-password',
        }),
      }),
    )

    await transport.started
    await expect(
      Promise.race([response.then(() => 'resolved' as const), Promise.resolve('pending' as const)]),
    ).resolves.toBe('pending')

    transport.release()
    await expect(response).resolves.toMatchObject({ status: 200 })

    const [log] = await database.select().from(emailDeliveryLogsTable)
    expect(transport.messages).toHaveLength(1)
    expect(log).toMatchObject({
      status: 'SENT',
      provider: 'cloudflare',
      providerMessageId: 'password-reset-receipt',
    })
  })
})

test('session cookies cannot retain old roles or authenticate after D1 revocation', async () => {
  await using d1Resource = await createMigratedD1Database()
  const database = Effect.runSync(withTestLayer(Database, DatabaseLayer(d1Resource.database)))

  const transport = Layer.succeed(EmailTransport, {
    send: () => Effect.succeed({ provider: 'cloudflare' as const, messageId: 'local-receipt' }),
  })

  const auth = await Effect.runPromise(
    withTestLayer(Auth, authLayer(d1Resource.database, transport)),
  )

  const signup = await auth.handler(
    new Request('http://localhost/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({
        name: 'Revocation fixture',
        email: 'revocation@example.test',
        password: 'LocalTest123!',
      }),
    }),
  )

  expect(signup.status).toBe(200)

  const identity = Schema.decodeUnknownSync(
    Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
  )(await signup.json())

  const cookie = signup.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')

  const read = () =>
    auth.handler(new Request('http://localhost/auth/get-session', { headers: { cookie } }))

  const sessionIdentity = Schema.Struct({ user: Schema.Struct({ role: Schema.String }) })
  expect(Schema.decodeUnknownSync(sessionIdentity)(await (await read()).json()).user.role).toBe(
    'user',
  )
  await database.update(user).set({ role: 'creator' }).where(eq(user.id, identity.user.id))
  expect(Schema.decodeUnknownSync(sessionIdentity)(await (await read()).json()).user.role).toBe(
    'creator',
  )
  await database.delete(session).where(eq(session.userId, identity.user.id))
  expect((await (await read()).json()) === null).toBe(true)
})
