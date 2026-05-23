import { Cause, Data, Effect, Exit } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { RouteConfig, RouteHandler } from '@hono/zod-openapi'
import { AppRuntime, type AppServices } from '@/runtime'
import type { AppBindings } from '@/lib/types'
import type {
  ConflictError,
  DatabaseError,
  NotFoundError,
  S3Error,
  SpotifyError,
  UnauthorizedError,
  ValidationError
} from '@/errors'

export type AppDomainError =
  | NotFoundError
  | ConflictError
  | DatabaseError
  | UnauthorizedError
  | ValidationError
  | S3Error
  | SpotifyError

export class HttpError extends Data.TaggedError('HttpError')<{
  status: number
  message: string
}> {}

const mapErrors = <A, R>(program: Effect.Effect<A, AppDomainError, R>) =>
  program.pipe(
    Effect.catchTags({
      NotFoundError: (e) =>
        Effect.fail(
          new HttpError({
            status: HttpStatusCodes.NOT_FOUND,
            message: e.message
          })
        ),
      ConflictError: (e) =>
        Effect.fail(
          new HttpError({
            status: HttpStatusCodes.CONFLICT,
            message: e.message
          })
        ),
      DatabaseError: (e) =>
        Effect.fail(
          new HttpError({
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: e.message
          })
        ),
      UnauthorizedError: (e) =>
        Effect.fail(
          new HttpError({
            status: HttpStatusCodes.UNAUTHORIZED,
            message: e.message
          })
        ),
      ValidationError: (e) =>
        Effect.fail(
          new HttpError({
            status: HttpStatusCodes.UNPROCESSABLE_ENTITY,
            message: e.message
          })
        ),
      S3Error: (e) =>
        Effect.fail(
          new HttpError({
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: e.message
          })
        ),
      SpotifyError: (e) =>
        Effect.fail(
          new HttpError({
            status: HttpStatusCodes.BAD_GATEWAY,
            message: e.message
          })
        )
    })
  )

type RouteContext<Route extends RouteConfig> = Parameters<
  RouteHandler<Route, AppBindings>
>[0]
type RouteResponse<Route extends RouteConfig> = ReturnType<
  RouteHandler<Route, AppBindings>
>

export async function runEffect<
  Route extends RouteConfig,
  T = unknown,
  R extends AppServices = AppServices
>(
  c: RouteContext<Route>,
  program: Effect.Effect<T, AppDomainError, R>,
  successStatus: ContentfulStatusCode = HttpStatusCodes.OK
): Promise<Awaited<RouteResponse<Route>>> {
  const exit = await AppRuntime.runPromiseExit(mapErrors(program))

  if (Exit.isFailure(exit)) {
    const failReason = exit.cause.reasons.find(Cause.isFailReason)
    if (failReason && failReason.error instanceof HttpError) {
      return c.json(
        { error: failReason.error.message },
        failReason.error.status as ContentfulStatusCode
      ) as unknown as Awaited<RouteResponse<Route>>
    }
    return c.json(
      { error: 'Internal server error' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    ) as unknown as Awaited<RouteResponse<Route>>
  }

  return c.json(exit.value, successStatus) as unknown as Awaited<
    RouteResponse<Route>
  >
}
