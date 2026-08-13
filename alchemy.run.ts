import * as Alchemy from 'alchemy'
import { adopt } from 'alchemy/AdoptPolicy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import { secretsStore } from './alchemy/secrets'
import { reminderSweepCron, sitemapRegenerationCron } from './apps/server/src/scheduled'
import type { NavigationLockDurableObject } from './apps/server/src/durable-objects/navigation-lock.do'
import type { SpotifyImportResolverDurableObject } from './apps/server/src/durable-objects/spotify-import-resolver.do'
import { emailDeploymentConfig } from './apps/server/src/email-deployment-config'

export default Alchemy.Stack(
  'gbfm',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack
    const isProduction = stack.stage === 'prod'
    const isLocalDev = yield* Alchemy.ALCHEMY_DEV
    const apiUrl = isProduction
      ? 'https://api.goosebumps.fm'
      : `https://api.${stack.stage}.goosebumps.fm`
    const secrets = yield* secretsStore(apiUrl)
    const emailConfig = emailDeploymentConfig({
      stage: stack.stage,
      testRecipient: process.env.EMAIL_TEST_RECIPIENT,
      localDev: isLocalDev
    })

    const email = yield* Effect.gen(function* () {
      if (emailConfig.transport === 'recording') return undefined

      const routing = yield* Cloudflare.Email.Routing('EmailRouting', { zone: 'goosebumps.fm' })
      yield* Cloudflare.Email.SendingSubdomain('EmailSending', {
        zoneId: routing.zoneId,
        name: emailConfig.sendingDomain
      })
      return isProduction
        ? yield* Cloudflare.Email.SendEmail('EMAIL', {
            allowedSenderAddresses: [emailConfig.emailSender]
          })
        : yield* Cloudflare.Email.SendEmail('EMAIL', {
            allowedSenderAddresses: [emailConfig.emailSender],
            destinationAddress: emailConfig.destinationAddress
          })
    })

    const db = yield* Cloudflare.D1.Database('Database', {
      migrationsDir: './apps/server/drizzle-d1'
    })

    const userContent = yield* Cloudflare.R2.Bucket('UserContent')
    const mixes = yield* Cloudflare.R2.Bucket('Mixes')

    const sitemap = yield* Cloudflare.KV.Namespace('Sitemap')

    const reminders = yield* Cloudflare.Queues.Queue('Reminders')

    const api = yield* Cloudflare.Worker('Api', {
      main: './apps/server/src/worker.ts',
      ...(isProduction ? { domain: 'api.goosebumps.fm' } : { url: true }),
      compatibility: { date: '2026-08-09', flags: ['nodejs_compat'] },
      crons: [reminderSweepCron, sitemapRegenerationCron],
      env: {
        DB: db,
        USER_CONTENT: userContent,
        MIXES: mixes,
        SITEMAP: sitemap,
        REMINDERS: reminders,
        ...(email === undefined ? {} : { EMAIL: email }),
        EMAIL_SENDER: emailConfig.emailSender,
        EMAIL_TRANSPORT_MODE: emailConfig.transport,
        NAVIGATION_LOCK: Cloudflare.DurableObject<NavigationLockDurableObject>('NavigationLock', {
          className: 'NavigationLockDurableObject'
        }),
        SPOTIFY_IMPORT_RESOLVER: Cloudflare.DurableObject<SpotifyImportResolverDurableObject>(
          'SpotifyImportResolver',
          {
            className: 'SpotifyImportResolverDurableObject'
          }
        ),
        APP_STAGE: stack.stage,
        USER_CONTENT_BUCKET_NAME: userContent.bucketName,
        MIXES_BUCKET_NAME: mixes.bucketName,
        SENTRY_ENVIRONMENT: stack.stage,
        ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? '',
        ...secrets,
        SENTRY_DSN: secrets.SENTRY_BACKEND_DSN,
        R2AccountId: userContent.accountId
      }
    })

    const cdnRouter = yield* Cloudflare.Worker('CdnRouter', {
      main: './workers/cdn-router/src/index.ts',
      ...(isProduction ? { domain: 'cdn.goosebumps.fm' } : { url: true }),
      compatibility: { date: '2026-08-09' },
      env: {
        USER_CONTENT: userContent,
        MIXES: mixes
      }
    })

    if (isProduction) {
      const zone = yield* Cloudflare.Zone.Zone('Zone', { name: 'goosebumps.fm' }).pipe(adopt(true))

      // These served /rss.xml, /sitemap.xml and /s/* off the VPS. The Worker
      // serves the same routes, so they move with the client rather than
      // pointing at a host that is being retired.
      yield* Cloudflare.Ruleset.Ruleset('VpsRedirects', {
        zone,
        phase: 'http_request_dynamic_redirect',
        name: 'Dynamic route redirects',
        rules: [
          {
            action: 'redirect',
            description: 'Redirect RSS feeds to the API',
            expression: `((http.request.uri.path eq "/rss.xml") or (http.request.uri.path eq "/rss")) and (http.host eq "goosebumps.fm")`,
            actionParameters: {
              fromValue: { statusCode: 301, targetUrl: { value: `${apiUrl}/rss.xml` } }
            }
          },
          {
            action: 'redirect',
            description: 'Redirect sitemap to the API',
            expression: `(http.request.uri.path eq "/sitemap.xml") and (http.host eq "goosebumps.fm")`,
            actionParameters: {
              fromValue: { statusCode: 301, targetUrl: { value: `${apiUrl}/sitemap.xml` } }
            }
          },
          {
            action: 'redirect',
            description: 'Redirect share routes to the API OG handlers',
            expression: `starts_with(http.request.uri.path, "/s/") and (http.host eq "goosebumps.fm")`,
            actionParameters: {
              fromValue: {
                statusCode: 301,
                targetUrl: { expression: `concat("${apiUrl}", http.request.uri.path)` },
                preserveQueryString: true
              }
            }
          }
        ]
      })
    }

    const www = yield* Cloudflare.Website.StaticSite('Www', {
      cwd: 'apps/www',
      command: 'bun run build',
      outdir: 'dist',
      ...(isProduction && process.env.WWW_TAKEOVER === 'true'
        ? { domain: ['www.goosebumps.fm', 'goosebumps.fm'] }
        : { url: true }),
      assets: { notFoundHandling: 'single-page-application' },
      env: {
        VITE_VPS_BASE_URL: apiUrl,
        VITE_PUBLIC_SENTRY_DSN: process.env.VITE_PUBLIC_SENTRY_DSN ?? '',
        VITE_PUBLIC_SENTRY_ENVIRONMENT: stack.stage,
        VITE_PUBLIC_SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? '',
        VITE_SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ?? ''
      }
    })

    yield* Cloudflare.Queues.Consumer('ReminderConsumer', {
      queueId: reminders.queueId,
      scriptName: api.workerName
    })

    return {
      apiUrl: api.url,
      apiDomains: api.domains,
      cdnRouterUrl: cdnRouter.url,
      cdnRouterDomains: cdnRouter.domains,
      wwwUrl: www.url,
      wwwDomains: www.domains,
      databaseName: db.databaseName,
      userContentBucketName: userContent.bucketName,
      mixesBucketName: mixes.bucketName
    }
  })
)
