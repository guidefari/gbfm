import { Effect, Layer, ManagedRuntime } from 'effect'
import { Database } from '@/db/layer'
import { NavigationLockLocalLayer } from '@/services/navigation-lock'
import { ConfigServiceLayer } from '@/services/config.service'
import { AwsObjectStoreClientLayer } from '@/services/storage/aws-object-store-client'
import { SpotifyImportResolverLocalLayer } from '@/services/spotify-import-resolver.service'
import { UnconfiguredEmailTransportLayer } from '@/services/email-transport.service'
import { SitemapCache as SitemapCacheTag } from '@/services/sitemap-cache'
import { AppLayer } from './services'
import { BunSentryServiceLive, BunTracingLive } from './sentry-bun'

// This module-level ManagedRuntime predates the Worker composition seam
// (worker.ts) and cannot see a real D1 binding or KV namespace -- Workers
// have no module-scope database/binding handle, and env is only visible
// inside fetch/scheduled/queue. Its only consumers are the Bun entrypoint
// (src/index.ts, via appServicesContext) and app.ts's SentryService init
// (via runApp); the runAppSync/runAppFork/disposeRuntime helpers this file
// used to export had no call sites left and were removed.
// Nothing on this path may depend on Database or SitemapCache resolving to a
// live connection. The Worker request path builds its own
// AppLayer({ database: DatabaseLayer(env.DB), sitemapCache: ... }) per
// invocation instead of touching this singleton.
const UnavailableDatabaseLive = Layer.effect(
  Database,
  Effect.die(
    'Database is not available on the module-level runtime singleton outside the Worker request path'
  )
)
const UnavailableSitemapCacheLive = Layer.effect(
  SitemapCacheTag,
  Effect.die(
    'SitemapCache is not available on the module-level runtime singleton outside the Worker request path'
  )
)

const configLive = ConfigServiceLayer
const awsObjectStoreLive = AwsObjectStoreClientLayer.pipe(Layer.provide(configLive))

// Bun has no Worker email binding. Local tests compose RecordingEmailTransportLayer
// explicitly; every Bun runtime instead fails closed before it can claim a fake receipt.
const bunEmailTransportLive = UnconfiguredEmailTransportLayer

const managedRuntime = ManagedRuntime.make(
  AppLayer({
    database: UnavailableDatabaseLive,
    sitemapCache: UnavailableSitemapCacheLive,
    navigationLock: NavigationLockLocalLayer,
    spotifyImportResolver: SpotifyImportResolverLocalLayer,
    sentry: BunSentryServiceLive,
    tracing: BunTracingLive,
    config: configLive,
    objectStore: awsObjectStoreLive,
    emailTransport: bunEmailTransportLive
  })
)

// The app's built service instances (DB pool, S3 client, etc.) as an Effect,
// for other layer chains (e.g. the Effect HttpApi router in http/routes.ts)
// to reuse via Layer.provideMerge instead of Layer.provide(AppLayer) building
// a second, independent copy of every singleton service.
export const appServicesContext = managedRuntime.contextEffect

export const runApp = managedRuntime.runPromise
