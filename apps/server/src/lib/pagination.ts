import { Effect, Schema, SchemaGetter, SchemaIssue } from 'effect'

const CoercedFinite = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.Finite, {
    decode: SchemaGetter.transformOrFail((value, options) =>
      Effect.try({
        try: () => Number(value),
        catch: () => new SchemaIssue.InvalidValue({ message: 'Expected number' }, value, options)
      })
    ),
    encode: SchemaGetter.passthrough()
  })
)

export const paginationQuerySchema = Schema.Struct({
  limit: CoercedFinite.pipe(
    Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
    Schema.withDecodingDefaultType(Effect.succeed(20))
  ),
  offset: CoercedFinite.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.withDecodingDefaultType(Effect.succeed(0))
  )
})

export const paginationMetadataSchema = Schema.Struct({
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number,
  hasMore: Schema.Boolean
})

export function createPaginatedResponseSchema<T extends Schema.Top>(dataSchema: T) {
  return Schema.Struct({
    data: Schema.Array(dataSchema),
    pagination: paginationMetadataSchema
  })
}

export type PaginationQuery = typeof paginationQuerySchema.Type

export type PaginationMetadata = typeof paginationMetadataSchema.Type

export type PaginatedResponse<T> = {
  data: T[]
  pagination: PaginationMetadata
}

export function calculateHasMore(total: number, offset: number, limit: number): boolean {
  return offset + limit < total
}

export function createPaginationMetadata(
  total: number,
  limit: number,
  offset: number
): PaginationMetadata {
  return {
    total,
    limit,
    offset,
    hasMore: calculateHasMore(total, offset, limit)
  }
}
