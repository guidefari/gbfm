export const localVPSPort = 3003

const { default: app, setupGracefulShutdown, startBackgroundEffects } = await import('./app')
const { createWebHandler } = await import('./http/routes')

const webHandler = createWebHandler(app)

setupGracefulShutdown(webHandler.dispose)
startBackgroundEffects()

export default {
  port: localVPSPort,
  fetch: webHandler.handler,
  maxRequestBodySize: 1024 * 1024 * 1000 // 1GB
}
