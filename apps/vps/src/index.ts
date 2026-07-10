export const localVPSPort = 3003

const { default: app, onShutdown } = await import('./app')

// Step 2 (docs/migration-effect-http-api.md): the process now serves through
// this handler. It wildcards every request to the same Hono app unchanged --
// app.ts still owns route setup, background forks, and its SIGTERM/SIGINT
// wiring. This is where the serving topology changes.
const { createWebHandler } = await import('./http/routes')
export const effectWebHandler = createWebHandler(app)

onShutdown(effectWebHandler.dispose)

export default {
  port: localVPSPort,
  fetch: effectWebHandler.handler,
  maxRequestBodySize: 1024 * 1024 * 1000 // 1GB
}
