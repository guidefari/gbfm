import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { AppRuntime } from '@/runtime'
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

  let finalCreatorIds: string[] = creatorIds || []
  if (finalCreatorIds.length === 0) {
    finalCreatorIds = [user.id]
  }

  const program = Effect.gen(function* () {
    const labelService = yield* LabelService
    return yield* labelService.create(labelData, finalCreatorIds)
  }).pipe(
    Effect.catchTag('ConflictError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.CREATED)
}

export const getAllLabels: AppRouteHandler<GetAllLabelsRoute> = async (c) => {
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const labelService = yield* LabelService
    return yield* labelService.getAll({ limit, offset })
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

export const getLabelBySlug: AppRouteHandler<GetLabelBySlugRoute> = async (
  c
) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const labelService = yield* LabelService
    return yield* labelService.getBySlug(slug)
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

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
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
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('UnauthorizedError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.UNAUTHORIZED
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}
