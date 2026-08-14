import * as Alchemy from 'alchemy'
import { adopt } from 'alchemy/AdoptPolicy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Output from 'alchemy/Output'
import * as Effect from 'effect/Effect'
import type { StageConfig } from './stage'

export const storage = (config: StageConfig) =>
  Effect.gen(function* () {
    const productionD1DatabaseName = config.isLocalDev
      ? (yield* Alchemy.stackRef<{ readonly databaseName: string }>('gbfm', {
          stage: 'prod'
        })).pipe(Output.map(({ databaseName }) => databaseName))
      : undefined
    const db = yield* Cloudflare.D1.Database('Database', {
      ...(productionD1DatabaseName ? { name: productionD1DatabaseName } : undefined),
      ...(config.isLocalDev ? undefined : { migrationsDir: './apps/server/drizzle-d1' })
    }).pipe(adopt(config.isLocalDev), Alchemy.remote(config.isLocalDev))

    // The browser PUTs image and audio bytes straight to the bucket with a
    // presigned URL, so the bucket itself has to allow the cross-origin PUT.
    // Ported from the S3 bucket's CORS block; without it every upload fails
    // the preflight.
    const userContent = yield* Cloudflare.R2.Bucket('UserContent', {
      cors: [
        {
          id: 'browser-presigned-uploads',
          allowedOrigins: config.isProduction
            ? ['https://www.goosebumps.fm', 'https://goosebumps.fm']
            : ['*'],
          allowedMethods: ['PUT'],
          allowedHeaders: ['*'],
          exposeHeaders: ['ETag'],
          maxAgeSeconds: 3600
        }
      ]
    })

    const mixes = yield* Cloudflare.R2.Bucket('Mixes')
    const sitemap = yield* Cloudflare.KV.Namespace('Sitemap')
    const reminders = yield* Cloudflare.Queues.Queue('Reminders')

    return { db, userContent, mixes, sitemap, reminders }
  })

export type Storage = Effect.Success<ReturnType<typeof storage>>
