import { Data, Effect, Schema } from 'effect'

export class ApiFailure extends Data.TaggedError('ApiFailure')<{ readonly status: number }> {}

export type ApiSchema = Schema.Codec<unknown, unknown>

/** Decodes an API response with its published schema, failing with the HTTP status. */
export const decodeApiResponse =
  <S extends ApiSchema>(schema: S) =>
  (response: Response): Effect.Effect<S['Type'], ApiFailure> =>
    Effect.succeed(response).pipe(
      Effect.filterOrFail(
        (candidate) => candidate.ok,
        (candidate) => new ApiFailure({ status: candidate.status }),
      ),
      Effect.flatMap((candidate) =>
        Effect.tryPromise({
          try: () => candidate.json(),
          catch: () => new ApiFailure({ status: 502 }),
        }),
      ),
      Effect.flatMap((body) =>
        Schema.decodeUnknownEffect(schema)(body).pipe(
          Effect.mapError(() => new ApiFailure({ status: 502 })),
        ),
      ),
    )
