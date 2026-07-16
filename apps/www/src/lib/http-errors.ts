import { HttpApiError } from 'effect/unstable/httpapi'

export function isNotFoundError(error: unknown): boolean {
  return error instanceof HttpApiError.NotFound
}
