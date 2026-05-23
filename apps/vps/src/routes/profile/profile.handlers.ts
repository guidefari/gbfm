import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { runEffect } from '@/lib/effect-hono'
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
    Effect.withSpan('api.profile.getPublic', { attributes: { username } })
  )

  return runEffect<GetPublicProfileRoute>(c, program)
}
