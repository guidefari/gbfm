import { Layer } from 'effect'
import { makeDatabaseClient } from '@/db/layer'
import { seedLocalUsers } from '@/db/seed-local-users'
import { ConfigService, createConfig } from '@/services/config.service'
import { createTestWebHandler } from '@/test/http-handler'
import { createMigratedD1Database } from '@/test/migrate-d1'

const port = Number(process.env.PORT ?? 3003)
const resource = await createMigratedD1Database()
await seedLocalUsers(makeDatabaseClient(resource.database))
const baseConfig = createConfig()
const configLive = Layer.succeed(ConfigService, {
  ...baseConfig,
  urls: {
    ...baseConfig.urls,
    frontend: process.env.FRONTEND_URL ?? 'http://127.0.0.1:5173'
  },
  auth: {
    ...baseConfig.auth,
    betterAuthSecret: process.env.BETTER_AUTH_SECRET ?? 'local-e2e-secret-at-least-32-characters',
    betterAuthUrl: process.env.BETTER_AUTH_URL ?? `http://127.0.0.1:${port}`
  }
})
const handler = createTestWebHandler(resource.database, undefined, undefined, undefined, configLive)

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  fetch: (request) => handler.handler(request)
})

console.log(`Local E2E API listening on ${server.url}`)

const stop = async () => {
  server.stop(true)
  await handler.dispose()
  await resource.dispose()
  process.exit()
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
