export const localVPSPort = Number(process.env.VPS_PORT ?? 3003)
export const localVPSHostname = process.env.VPS_HOSTNAME ?? '0.0.0.0'

// Step 2 (docs/migration-effect-http-api.md): the process serves through this
// handler. app.ts (imported for its side effects -- SentryService init) no
// longer owns any route setup as of step 8; all real route serving lives in
// http/routes.ts's createWebHandler.
await import('./app')
const { createWebHandler } = await import('./http/routes')
export const effectWebHandler = createWebHandler()

export default {
  port: localVPSPort,
  hostname: localVPSHostname,
  fetch: effectWebHandler.handler,
  maxRequestBodySize: 1024 * 1024 * 1000 // 1GB
}
