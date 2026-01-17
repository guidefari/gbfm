import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { AppRuntime } from '@/runtime'
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
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
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

export const getReleasesByLabel: AppRouteHandler<
  GetReleasesByLabelRoute
> = async (c) => {
  const { labelSlug } = c.req.valid('param')
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const releaseService = yield* ReleaseService
    return yield* releaseService.getByLabelSlug(labelSlug, { limit, offset })
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

export const getReleaseBySlug: AppRouteHandler<GetReleaseBySlugRoute> = async (
  c
) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const releaseService = yield* ReleaseService
    return yield* releaseService.getBySlug(slug)
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

export const deleteReleaseBySlug: AppRouteHandler<
  DeleteReleaseBySlugRoute
> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const releaseService = yield* ReleaseService
    yield* releaseService.delete(slug)
    return { message: 'Release deleted successfully' } as const
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
