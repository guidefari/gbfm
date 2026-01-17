import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { ConflictError, NotFoundError } from '@/errors'
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
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return c.json(
      { error: 'Failed to fetch publications' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  const { data, total } = result.right
  return c.json(
    {
      data,
      pagination: createPaginationMetadata(total, limit, offset)
    },
    HttpStatusCodes.OK
  )
}

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const service = yield* PublicationService
    return yield* service.getPublicationById(id)
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    if (error instanceof NotFoundError) {
      return c.json(
        { error: 'Publication not found' },
        HttpStatusCodes.NOT_FOUND
      )
    }
    return c.json(
      { error: 'Failed to fetch publication' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json(result.right, HttpStatusCodes.OK)
}

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const validated = c.req.valid('json')

  const program = Effect.gen(function* () {
    const service = yield* PublicationService
    return yield* service.createPublication(validated)
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    if (error instanceof ConflictError) {
      return c.json(
        { error: 'Publication with this slug already exists' },
        HttpStatusCodes.CONFLICT
      )
    }
    return c.json(
      { error: 'Failed to create publication' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json(result.right, HttpStatusCodes.CREATED)
}

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const validated = c.req.valid('json')

  const program = Effect.gen(function* () {
    const service = yield* PublicationService
    return yield* service.updatePublication(id, validated)
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    if (error instanceof NotFoundError) {
      return c.json(
        { error: 'Publication not found' },
        HttpStatusCodes.NOT_FOUND
      )
    }
    return c.json(
      { error: 'Failed to update publication' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json(result.right, HttpStatusCodes.OK)
}

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const service = yield* PublicationService
    return yield* service.deletePublication(id)
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    if (error instanceof NotFoundError) {
      return c.json(
        { error: 'Publication not found' },
        HttpStatusCodes.NOT_FOUND
      )
    }
    return c.json(
      { error: 'Failed to delete publication' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json(result.right, HttpStatusCodes.OK)
}
