declare module 'cloudflare:workers' {
  export const env: import('./telemetry/server').BrowserTelemetryEnv & {
    readonly API: { fetch(request: Request): Promise<Response> }
    readonly SOCIAL_IMAGES: { fetch(request: Request): Promise<Response> }
  }
}
