const LOCAL_API_ORIGIN = 'http://127.0.0.1:3003'

/** Inputs that determine where API requests are sent in browser and server runtimes. */
export interface ApiOriginOptions {
  readonly publicBaseUrl: string | undefined
  readonly serverProxyTarget: string | undefined
  readonly browserOrigin: string | undefined
}

/** Resolves the API origin without coupling server requests to the frontend port. */
export function resolveApiOrigin({
  publicBaseUrl,
  serverProxyTarget,
  browserOrigin
}: ApiOriginOptions): string {
  return publicBaseUrl || serverProxyTarget || browserOrigin || LOCAL_API_ORIGIN
}

/** API origin for the current browser or server runtime. */
export const API_ORIGIN = resolveApiOrigin({
  publicBaseUrl: import.meta.env.VITE_VPS_BASE_URL,
  serverProxyTarget: import.meta.env.SSR ? process.env.VPS_PROXY_TARGET : undefined,
  browserOrigin: import.meta.env.SSR ? undefined : window.location.origin
})
