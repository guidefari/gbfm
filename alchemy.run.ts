import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'

export default Alchemy.Stack(
  'gbfm',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack
    const isProduction = stack.stage === 'prod'

    const db = yield* Cloudflare.D1.Database('Database', {
      migrationsDir: './apps/vps/drizzle-d1'
    })

    const userContent = yield* Cloudflare.R2.Bucket('UserContent')
    const mixes = yield* Cloudflare.R2.Bucket('Mixes')

    const sitemap = yield* Cloudflare.KV.Namespace('Sitemap')

    const reminders = yield* Cloudflare.Queues.Queue('Reminders')

    const api = yield* Cloudflare.Worker('Api', {
      main: './apps/vps/src/worker.ts',
      ...(isProduction ? { domain: 'api.goosebumps.fm' } : { url: true }),
      compatibility: { date: '2026-08-09', flags: ['nodejs_compat'] },
      crons: ['* * * * *'],
      env: {
        DB: db,
        USER_CONTENT: userContent,
        MIXES: mixes,
        SITEMAP: sitemap,
        REMINDERS: reminders
      }
    })

    return {
      apiUrl: api.url,
      apiDomains: api.domains,
      databaseName: db.databaseName,
      userContentBucketName: userContent.bucketName,
      mixesBucketName: mixes.bucketName
    }
  })
)
