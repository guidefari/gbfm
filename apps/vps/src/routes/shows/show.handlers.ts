import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { runEffect } from '@/lib/effect-hono'
import { AppRuntime } from '@/runtime'
import { QRCodeService } from '@/services/qrcode.service'
import { ShowService, ShowSubscriptionService } from '@/services/show.service'

import type {
  CreateShowRoute,
  DeleteShowBySlugRoute,
  GetAllShowsRoute,
  GetShowBySlugRoute,
  GetShowEpisodesRoute,
  GetShowQRPdfRoute,
  SubscribeToShowRoute,
  UnsubscribeFromShowRoute,
  UpdateShowBySlugRoute
} from './show.routes'

export const getAllShows: AppRouteHandler<GetAllShowsRoute> = async (c) => {
  const { limit, offset } = c.req.valid('query')
  const isAdmin = c.get('user')?.role === 'admin'

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.getAll({ limit, offset, includeDrafts: isAdmin })
  }).pipe(Effect.withSpan('api.show.getAll'))

  return runEffect<GetAllShowsRoute>(c, program)
}

export const getShowBySlug: AppRouteHandler<GetShowBySlugRoute> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.getBySlug(slug)
  }).pipe(Effect.withSpan('api.show.getBySlug', { attributes: { slug } }))

  return runEffect<GetShowBySlugRoute>(c, program)
}

export const createShow: AppRouteHandler<CreateShowRoute> = async (c) => {
  const { hostIds, ...showData } = c.req.valid('json')
  const user = c.get('user')
  const finalHostIds = hostIds?.length ? hostIds : [user.id]

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.create(showData, finalHostIds)
  }).pipe(Effect.withSpan('api.show.create'))

  return runEffect<CreateShowRoute>(c, program, HttpStatusCodes.CREATED)
}

export const updateShowBySlug: AppRouteHandler<UpdateShowBySlugRoute> = async (
  c
) => {
  const { slug } = c.req.valid('param')
  const updateData = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.update(
      slug,
      user.id,
      user.role || 'user',
      updateData
    )
  }).pipe(Effect.withSpan('api.show.update', { attributes: { slug } }))

  return runEffect<UpdateShowBySlugRoute>(c, program)
}

export const deleteShowBySlug: AppRouteHandler<DeleteShowBySlugRoute> = async (
  c
) => {
  const { slug } = c.req.valid('param')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    return yield* showService.delete(slug, user.id, user.role || 'user')
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.catchTag('UnauthorizedError', (e) =>
      Effect.succeed({ error: e.message, unauthorized: true } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message, serverError: true } as const)
    ),
    Effect.withSpan('api.show.delete', { attributes: { slug } })
  )

  const result = await AppRuntime.runPromise(program)
  if (result && 'notFound' in result)
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  if (result && 'unauthorized' in result)
    return c.json({ error: result.error }, HttpStatusCodes.UNAUTHORIZED)
  if (result && 'serverError' in result)
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
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
  }).pipe(Effect.withSpan('api.show.getEpisodes', { attributes: { slug } }))

  return runEffect<GetShowEpisodesRoute>(c, program)
}

export const subscribeToShow: AppRouteHandler<SubscribeToShowRoute> = async (
  c
) => {
  const { id: showId } = c.req.valid('param')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const subscriptionService = yield* ShowSubscriptionService
    return yield* subscriptionService.subscribe(user.id, showId)
  }).pipe(Effect.withSpan('api.show.subscribe', { attributes: { showId } }))

  return runEffect<SubscribeToShowRoute>(c, program, HttpStatusCodes.CREATED)
}

export const unsubscribeFromShow: AppRouteHandler<
  UnsubscribeFromShowRoute
> = async (c) => {
  const { id: showId } = c.req.valid('param')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const subscriptionService = yield* ShowSubscriptionService
    return yield* subscriptionService.unsubscribe(user.id, showId)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({ error: e.message, notFound: true } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({ error: e.message, serverError: true } as const)
    ),
    Effect.withSpan('api.show.unsubscribe', { attributes: { showId } })
  )

  const result = await AppRuntime.runPromise(program)
  if (result && 'notFound' in result)
    return c.json({ error: result.error }, HttpStatusCodes.NOT_FOUND)
  if (result && 'serverError' in result)
    return c.json(
      { error: result.error },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  return c.body(null, HttpStatusCodes.NO_CONTENT)
}

export const getShowQRPdf: AppRouteHandler<GetShowQRPdfRoute> = async (c) => {
  const { slug } = c.req.valid('param')
  const { force } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const showService = yield* ShowService
    const qrService = yield* QRCodeService
    const show = yield* showService.getBySlug(slug)
    return yield* qrService.generateShowQRPdf(
      {
        slug: show.slug,
        title: show.title,
        thumbnailUrl: show.thumbnailUrl,
        hosts: show.hosts
      },
      force
    )
  }).pipe(Effect.withSpan('api.show.getQRPdf', { attributes: { slug } }))

  return runEffect<GetShowQRPdfRoute>(c, program)
}
