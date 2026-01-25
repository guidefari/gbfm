import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { AppRuntime } from '@/runtime'
import { ShowService } from '@/services/show.service'

import type {
  CreateShowRoute,
  DeleteShowBySlugRoute,
  GetAllShowsRoute,
  GetShowBySlugRoute,
  GetShowEpisodesRoute,
  GetUserSubscriptionsRoute,
  SubscribeToShowRoute,
  UnsubscribeFromShowRoute,
  UpdateShowBySlugRoute
} from './show.routes'

export const getAllShows: AppRouteHandler<GetAllShowsRoute> = async (c) => {
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.getAll({ limit, offset })
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

export const getShowBySlug: AppRouteHandler<GetShowBySlugRoute> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.getBySlug(slug)
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

export const createShow: AppRouteHandler<CreateShowRoute> = async (c) => {
  const { hostIds, ...showData } = c.req.valid('json')
  const user = c.get('user')

  let finalHostIds: string[] = hostIds || []
  if (finalHostIds.length === 0) {
    finalHostIds = [user.id]
  }

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.create(showData, finalHostIds)
  }).pipe(
    Effect.catchTag('ConflictError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.CONFLICT
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

export const updateShowBySlug: AppRouteHandler<
  UpdateShowBySlugRoute
> = async (c) => {
  const { slug } = c.req.valid('param')
  const updateData = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.update(slug, user.id, user.role || 'user', updateData)
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

export const deleteShowBySlug: AppRouteHandler<
  DeleteShowBySlugRoute
> = async (c) => {
  const { slug } = c.req.valid('param')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.delete(slug, user.id, user.role || 'user')
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

  if (result && 'error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

export const getShowEpisodes: AppRouteHandler<GetShowEpisodesRoute> = async (
  c
) => {
  const { slug } = c.req.valid('param')
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.getEpisodes(slug, { limit, offset })
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

export const subscribeToShow: AppRouteHandler<SubscribeToShowRoute> = async (
  c
) => {
  const { id: showId } = c.req.valid('param')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.subscribe(user.id, showId)
  }).pipe(
    Effect.catchTag('ConflictError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.CONFLICT
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

export const unsubscribeFromShow: AppRouteHandler<
  UnsubscribeFromShowRoute
> = async (c) => {
  const { id: showId } = c.req.valid('param')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.unsubscribe(user.id, showId)
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

  if (result && 'error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

export const getUserSubscriptions: AppRouteHandler<
  GetUserSubscriptionsRoute
> = async (c) => {
  const { limit, offset } = c.req.valid('query')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.getUserSubscriptions(user.id, { limit, offset })
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
