export const localVPSPort = 3003

const { default: app } = await import('./app')

export default {
  port: localVPSPort,
  fetch: app.fetch,
  maxRequestBodySize: 1024 * 1024 * 1000, // 1GB
  hostname: '127.0.0.1'
}
