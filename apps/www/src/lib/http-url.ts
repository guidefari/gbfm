const VPS_BASE_URL = import.meta.env.VITE_VPS_BASE_URL || ''
const browserOrigin = () => window.location.origin

export function makeApiUrl(path: string, baseUrl: string) {
  return `${baseUrl}/api${path}`
}

export function makeApiUrlObj(path: string, baseUrl: string, origin: string) {
  const withApi = `/api${path}`
  return baseUrl ? new URL(`${baseUrl}${withApi}`) : new URL(withApi, origin)
}

export function makePublicUrl(path: string, baseUrl: string) {
  return `${baseUrl}${path}`
}

export function makePublicUrlObj(path: string, baseUrl: string, origin: string) {
  return baseUrl ? new URL(`${baseUrl}${path}`) : new URL(path, origin)
}

export function apiUrl(path: string): string {
  return makeApiUrl(path, VPS_BASE_URL)
}

export function apiUrlObj(path: string): URL {
  return makeApiUrlObj(path, VPS_BASE_URL, browserOrigin())
}

export function publicUrl(path: string): string {
  return makePublicUrl(path, VPS_BASE_URL)
}

export function publicUrlObj(path: string): URL {
  return makePublicUrlObj(path, VPS_BASE_URL, browserOrigin())
}
