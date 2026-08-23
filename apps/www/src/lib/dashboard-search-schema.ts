import { Effect, Option, Schema, SchemaGetter, SchemaIssue } from 'effect'

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

const Offset = CoercedFinite.pipe(
  Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  Schema.catchDecoding(() => Effect.succeed(Option.some(0))),
  Schema.withDecodingDefaultType(Effect.succeed(0))
)

const Sort = Schema.Literals(['plays', 'created']).pipe(
  Schema.catchDecoding(() => Effect.succeed(Option.some('created'))),
  Schema.withDecodingDefaultType(Effect.succeed<'created'>('created'))
)

const Order = Schema.Literals(['asc', 'desc']).pipe(
  Schema.catchDecoding(() => Effect.succeed(Option.some('desc'))),
  Schema.withDecodingDefaultType(Effect.succeed<'desc'>('desc'))
)

export const dashboardOffsetSearchSchema = Schema.Struct({ offset: Offset })

export const dashboardMixesSearchSchema = Schema.Struct({
  offset: Offset,
  sort: Sort,
  order: Order
})
