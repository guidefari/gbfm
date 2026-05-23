import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { runEffect } from '@/lib/effect-hono'
import { ResolveService } from '@/services/resolve.service'

import type { ResolveSlugRoute } from './resolve.routes'

export const resolveSlug: AppRouteHandler<ResolveSlugRoute> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const resolveService = yield* ResolveService
    return yield* resolveService.resolve(slug)
  }).pipe(Effect.withSpan('api.resolve.slug', { attributes: { slug } }))

  return runEffect<ResolveSlugRoute>(c, program)
}
