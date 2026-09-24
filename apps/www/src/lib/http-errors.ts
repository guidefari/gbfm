import { HttpApiError } from 'effect/unstable/httpapi'

export function isNotFoundError(cause: unknown): boolean {
  return cause instanceof HttpApiError.NotFound
}

/** Converts a typed API 404 into absence while preserving every other failure. */
export async function nullOnNotFound<Value>(promise: Promise<Value>): Promise<Value | null> {
  try {
    return await promise
  } catch (cause) {
    if (isNotFoundError(cause)) return null
    throw cause
  }
}
