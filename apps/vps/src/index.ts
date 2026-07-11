export const localVPSPort = 3003

const { default: app } = await import('./app')

// Step 2a (docs/migration-effect-http-api.md): proves the toWebHandler + fallback
// layer builds and serves identically to the Hono app. Not wired to Bun.serve yet.
const { createWebHandler } = await import('./http/routes')
export const effectWebHandler = createWebHandler(app)

export default {
  port: localVPSPort,
  fetch: app.fetch,
  maxRequestBodySize: 1024 * 1024 * 1000 // 1GB
}
