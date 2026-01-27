import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { AppRuntime } from '@/runtime'
import { ProfileService } from '@/services/profile.service'

import type { GetPublicProfileRoute } from './profile.routes'

export const getPublicProfile: AppRouteHandler<GetPublicProfileRoute> = async (
  c
) => {
  const { username } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const profileService = yield* ProfileService
    return yield* profileService.getPublicProfile(username)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(
    program.pipe(
      Effect.withSpan('api.profile.getPublic', { attributes: { username } })
    )
  )

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}
