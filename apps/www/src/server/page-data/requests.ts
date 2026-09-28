import { Effect } from 'effect'

import { apiRequest } from '../api'

export const optionalPageRequest = (request: Request, path: string) =>
  Effect.tryPromise(() => apiRequest(request, path, { method: 'GET' })).pipe(
    Effect.orElseSucceed(() => null),
  )
