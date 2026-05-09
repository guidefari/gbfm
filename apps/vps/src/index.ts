import { BunContext } from '@effect/platform-bun'
import { Console, Effect } from 'effect'
import { checkPortAvailable, formatLsofTable, lsofPort } from './lib/port-check'

export const localVPSPort = 3003

await Effect.runPromise(
  checkPortAvailable(localVPSPort).pipe(
    Effect.asVoid,
    Effect.catchTag('SocketServerError', (error) =>
      Effect.gen(function* () {
        const raw = yield* lsofPort(localVPSPort)
        const table = raw ? formatLsofTable(raw) : null

        yield* Console.error(
          `Error: Port ${localVPSPort} is not available. Another process may already be using this port.\n${
            error.cause instanceof Error
              ? error.cause.message
              : String(error.cause)
          }`
        )
        if (table) {
          yield* Console.error(
            `\nProcesses listening on port ${localVPSPort}:\n${table}`
          )
        } else {
          yield* Console.error(
            '\nCould not enumerate listeners (lsof unavailable or no results).'
          )
        }
        process.exit(1)
      })
    ),
    Effect.provide(BunContext.layer)
  )
)

const { default: app } = await import('./app')

// console.log({envWatcher: process.env})

export default {
  port: localVPSPort,
  fetch: app.fetch,
  maxRequestBodySize: 1024 * 1024 * 1000 // 1GB
}
