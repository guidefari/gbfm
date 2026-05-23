import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { runEffect } from '@/lib/effect-hono'
import { ReleaseService } from '@/services/release.service'

import type {
  CreateReleaseRoute,
  DeleteReleaseBySlugRoute,
  GetReleaseBySlugRoute,
  GetReleasesByLabelRoute,
  UpdateReleaseBySlugRoute
} from './release.routes'

export const createRelease: AppRouteHandler<CreateReleaseRoute> = async (c) => {
  const releaseData = c.req.valid('json')

  const program = Effect.gen(function* () {
    const releaseService = yield* ReleaseService
    return yield* releaseService.create({
      ...releaseData,
      releaseDate: new Date(releaseData.releaseDate)
    })
  })

  return runEffect<CreateReleaseRoute>(c, program, HttpStatusCodes.CREATED)
}

export const getReleasesByLabel: AppRouteHandler<
  GetReleasesByLabelRoute
> = async (c) => {
  const { labelSlug } = c.req.valid('param')
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const releaseService = yield* ReleaseService
    return yield* releaseService.getByLabelSlug(labelSlug, { limit, offset })
  })

  return runEffect<GetReleasesByLabelRoute>(c, program)
}

export const getReleaseBySlug: AppRouteHandler<GetReleaseBySlugRoute> = async (
  c
) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const releaseService = yield* ReleaseService
    return yield* releaseService.getBySlug(slug)
  })

  return runEffect<GetReleaseBySlugRoute>(c, program)
}

export const updateReleaseBySlug: AppRouteHandler<
  UpdateReleaseBySlugRoute
> = async (c) => {
  const { slug } = c.req.valid('param')
  const updateData = c.req.valid('json')

  const program = Effect.gen(function* () {
    const releaseService = yield* ReleaseService
    return yield* releaseService.update(slug, {
      ...updateData,
      releaseDate: updateData.releaseDate
        ? new Date(updateData.releaseDate)
        : undefined
    })
  })

  return runEffect<UpdateReleaseBySlugRoute>(c, program)
}

export const deleteReleaseBySlug: AppRouteHandler<
  DeleteReleaseBySlugRoute
> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const releaseService = yield* ReleaseService
    yield* releaseService.delete(slug)
    return { message: 'Release deleted successfully' } as const
  })

  return runEffect<DeleteReleaseBySlugRoute>(c, program)
}
