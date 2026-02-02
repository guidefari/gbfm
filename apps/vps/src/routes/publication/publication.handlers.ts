import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { createPaginationMetadata } from '@/lib/pagination'
import type { AppRouteHandler } from '@/lib/types'
import { runApp } from '@/runtime'
import { PublicationService } from '@/services/publication.service'

import type {
  CreateRoute,
  GetOneRoute,
  ListRoute,
  PatchRoute,
  RemoveRoute
} from './publication.routes'

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const service = yield* PublicationService
    return yield* service.getPublications(limit, offset)
  }).pipe(
    Effect.map(
      ({ data, total }) =>
        ({
          data: {
            data,
            pagination: createPaginationMetadata(total, limit, offset)
          },
          status: HttpStatusCodes.OK
        }) as const
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to fetch publications',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const service = yield* PublicationService
    return yield* service.getPublicationById(id)
  }).pipe(
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed({
        error: 'Publication not found',
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to fetch publication',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const validated = c.req.valid('json')

  const program = Effect.gen(function* () {
    const service = yield* PublicationService
    return yield* service.createPublication(validated)
  }).pipe(
    Effect.map((data) => ({ data, status: HttpStatusCodes.CREATED }) as const),
    Effect.catchTag('ConflictError', () =>
      Effect.succeed({
        error: 'Publication with this slug already exists',
        status: HttpStatusCodes.CONFLICT
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to create publication',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const validated = c.req.valid('json')

  const program = Effect.gen(function* () {
    const service = yield* PublicationService
    return yield* service.updatePublication(id, validated)
  }).pipe(
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed({
        error: 'Publication not found',
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to update publication',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const service = yield* PublicationService
    return yield* service.deletePublication(id)
  }).pipe(
    Effect.map((data) => ({ data, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed({
        error: 'Publication not found',
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed({
        error: 'Failed to delete publication',
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.data, result.status)
}
