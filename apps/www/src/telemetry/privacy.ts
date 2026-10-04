const TOKEN = /^[a-zA-Z0-9._:-]{1,80}$/

export function boundedName(value: string, fallback: string): string {
  return TOKEN.test(value) ? value : fallback
}

/** Emits only fixed route templates; account names, slugs, tokens, and query strings never become telemetry dimensions. */
export function routeTemplate(routeId: string | null | undefined, pathname: string): string {
  if (routeId?.startsWith('/') && routeId.length <= 120)
    return routeId.replace(/\([^)]*\)\/?/g, '') || '/'

  if (pathname === '/') return '/'
  const [first, second, third] = pathname.split('/').filter(Boolean)

  if (
    first &&
    [
      'shows',
      'mixes',
      'tracks',
      'editorial',
      'tweets',
      'labels',
      'releases',
      'tags',
      'djs',
    ].includes(first)
  )
    return second ? `/${first}/:slug` : `/${first}`

  if (first === 'tweet') return second ? '/tweet/:slug' : '/tweet'

  if (first === 'profile') return '/profile/:username'

  if (first === 'dashboard') return second ? '/dashboard/:section' : '/dashboard'

  if (first === 'auth') return '/auth/:action'

  if (first === 'new') return '/new/:kind'

  if (
    first &&
    [
      'about',
      'privacy',
      'terms',
      'changelog',
      'subscribe',
      'unsubscribe',
      'reminders',
      'mix-upload',
    ].includes(first) &&
    !second
  )
    return `/${first}`

  if (first === 'api') return '/api/:endpoint'

  if (first === 'actions') return '/actions/:action'

  if (first && !second && !third) return '/:slug'

  return '/unknown'
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Returns only a deterministic fingerprint; the sanitized text is never transported. */
export function errorFingerprint(value: Error | string, category: 'error' | 'rejection'): string {
  const message = value instanceof Error ? `${value.name}:${value.message}` : value

  const sanitized = message
    .toLowerCase()
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '<email>')
    .replace(/https?:\/\/\S+/gi, '<url>')
    .replace(/\b(?:\d[ -]*?){6,}\b/g, '<number>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<id>')
    .replace(/\d+/g, '#')
    .slice(0, 300)

  return `${category}.${fnv1a(sanitized)}`
}
