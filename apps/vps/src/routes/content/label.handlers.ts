import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { runEffect } from '@/lib/effect-hono'
import { LabelService } from '@/services/label.service'

import type {
  CreateLabelRoute,
  GetAllLabelsRoute,
  GetLabelBySlugRoute,
  UpdateLabelBySlugRoute
} from './label.routes'

export const createLabel: AppRouteHandler<CreateLabelRoute> = async (c) => {
  const { creatorIds, ...labelData } = c.req.valid('json')
  const user = c.get('user')

  const finalCreatorIds = creatorIds?.length ? creatorIds : [user.id]

  const program = Effect.gen(function* () {
    const labelService = yield* LabelService
    return yield* labelService.create(labelData, finalCreatorIds)
  })

  return runEffect<CreateLabelRoute>(c, program, HttpStatusCodes.CREATED)
}

export const getAllLabels: AppRouteHandler<GetAllLabelsRoute> = async (c) => {
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const labelService = yield* LabelService
    return yield* labelService.getAll({ limit, offset })
  })

  return runEffect<GetAllLabelsRoute>(c, program)
}

export const getLabelBySlug: AppRouteHandler<GetLabelBySlugRoute> = async (
  c
) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const labelService = yield* LabelService
    return yield* labelService.getBySlug(slug)
  })

  return runEffect<GetLabelBySlugRoute>(c, program)
}

export const updateLabelBySlug: AppRouteHandler<
  UpdateLabelBySlugRoute
> = async (c) => {
  const { slug } = c.req.valid('param')
  const updateData = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const labelService = yield* LabelService
    return yield* labelService.update(slug, user.id, updateData)
  })

  return runEffect<UpdateLabelBySlugRoute>(c, program)
}
