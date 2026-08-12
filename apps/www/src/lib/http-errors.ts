import { HttpApiError } from 'effect/unstable/httpapi'

export function isNotFoundError(cause: unknown): boolean {
  return cause instanceof HttpApiError.NotFound
}
