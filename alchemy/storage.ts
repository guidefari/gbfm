import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import type { StageConfig } from './stage'

export const storage = (config: StageConfig) =>
  Effect.gen(function* () {
    const db = yield* Cloudflare.D1.Database('Database', {
      migrationsDir: './apps/server/drizzle-d1'
    })

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
