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
