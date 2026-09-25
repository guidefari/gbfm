import { Schema } from 'effect'

const STORAGE_KEY = 'gbfm.telemetry.session.v1'

export const SESSION_TTL_MS = 24 * 60 * 60 * 1_000

type StoredSession = { readonly id: string; readonly createdAt: number }

const StoredSession = Schema.Struct({ id: Schema.String, createdAt: Schema.Number })

const decodeStoredSession = Schema.decodeUnknownSync(StoredSession, { onExcessProperty: 'error' })

export function anonymousSession(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  now: number,
  randomId: () => string = () => crypto.randomUUID().replaceAll('-', ''),
): string {
  try {
    const parsed = decodeStoredSession(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null'))

    if (
      parsed.id.length >= 20 &&
      now >= parsed.createdAt &&
      now - parsed.createdAt < SESSION_TTL_MS
    )
      return parsed.id
  } catch {
    // Unavailable or corrupt storage is replaced below.
  }

  const session: StoredSession = { id: randomId(), createdAt: now }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Privacy modes may deny storage; this page-lifetime ID is still anonymous.
  }

  return session.id
}
