import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

/** Maximum remaining lifetime of a preview bearer grant, in milliseconds. */
export const PREVIEW_TTL_MS = 300_000

/** Signed access to one canonical CDN asset at one CDN origin. */
export interface PreviewGrantClaims {
  readonly path: string
  readonly audience: string
  readonly expiresAt: number
}

const canonicalPath = (path: string) =>
  /^\/(?:user-content|mixes)\/private\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(path) &&
  !path.split('/').some((segment) => segment === '.' || segment === '..')

/** Recognizes canonical private media paths on both bucket routes; never decodes aliases. */
export function isPrivateMediaPath(pathname: string): boolean {
  return canonicalPath(pathname)
}

const parseClaims = Schema.decodeUnknownOption(
  Schema.Struct({ path: Schema.String, audience: Schema.String, expiresAt: Schema.Number }).check(
    Schema.makeFilter((value) => {
      if (
        !value.path.startsWith('/user-content/private/') ||
        !canonicalPath(value.path) ||
        !Number.isSafeInteger(value.expiresAt) ||
        value.expiresAt <= 0
      )
        return false

      try {
        const audience = new URL(value.audience)

        return audience.protocol === 'https:' && audience.origin === value.audience
      } catch {
        return false
      }
    }),
  ),
  { onExcessProperty: 'error' },
)

const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')

const decode = (value: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null

  const bytes = Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  )

  return encode(bytes) === value ? bytes : null
}

const importKey = (secret: string) =>
  crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )

/** Signs canonical claims. Invalid programmer-supplied claims or an empty key throw, without token details. */
export async function createPreviewGrant(
  claims: PreviewGrantClaims,
  secret: string,
): Promise<string> {
  const parsed = Option.getOrNull(parseClaims(claims))

  if (parsed === null || secret.length === 0) throw new Error('Invalid preview grant configuration')
  const payload = encode(new TextEncoder().encode(JSON.stringify(parsed)))

  const signature = await crypto.subtle.sign(
    'HMAC',
    await importKey(secret),
    new TextEncoder().encode(payload),
  )

  return `${payload}.${encode(new Uint8Array(signature))}`
}

/** Authenticates a bounded, unexpired grant for the exact audience; malformed input fails closed. */
export async function verifyPreviewGrant(
  token: string,
  secret: string,
  audience: string,
  now: number,
): Promise<PreviewGrantClaims | null> {
  if (token.length > 4096 || secret.length === 0 || !Number.isSafeInteger(now)) return null

  try {
    const parts = token.split('.')

    if (parts.length !== 2) return null
    const [payload, signature] = parts

    if (payload === undefined || signature === undefined) return null
    const bytes = decode(payload)
    const mac = decode(signature)

    if (bytes === null || mac === null || mac.length !== 32) return null

    if (
      !(await crypto.subtle.verify(
        'HMAC',
        await importKey(secret),
        mac,
        new TextEncoder().encode(payload),
      ))
    )
      return null

    const raw: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes),
    )

    const claims = Option.getOrNull(parseClaims(raw))

    if (
      claims === null ||
      claims.audience !== audience ||
      claims.expiresAt <= now ||
      claims.expiresAt - now > PREVIEW_TTL_MS
    )
      return null

    return claims
  } catch {
    return null
  }
}
