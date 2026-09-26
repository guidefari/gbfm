import type { RequestEvent } from '@sveltejs/kit'
import { Effect } from 'effect'

import { apiRequest } from './api-gateway'
import { ApiFailure, type ApiSchema, decodeApiResponse } from './api-response'

export { ApiFailure } from './api-response'

type ApiEvent = Pick<RequestEvent, 'platform' | 'request' | 'locals'>

export const apiJson = <S extends ApiSchema>(
  event: ApiEvent,
  path: string,
  schema: S,
  init?: RequestInit,
): Effect.Effect<S['Type'], ApiFailure> =>
  Effect.tryPromise({
    try: () => apiRequest(event, path, init),
    catch: () => new ApiFailure({ status: 503 }),
  }).pipe(Effect.flatMap(decodeApiResponse(schema)))
