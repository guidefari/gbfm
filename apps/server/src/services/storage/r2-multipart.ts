import { Effect, Schema } from 'effect'

const MultipartPart = Schema.Struct({
  partNumber: Schema.NumberFromString.pipe(
    Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(10000)),
  ),
  etag: Schema.NonEmptyString,
  size: Schema.NumberFromString.pipe(
    Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  ),
})

export class InvalidMultipartPart extends Schema.TaggedError<
  InvalidMultipartPart,
  { readonly brand: unique symbol }
>()('InvalidMultipartPart', { partIndex: Schema.Number, message: Schema.String }) {}

const extractTag = (body: string, name: string) =>
  new RegExp(`<${name}>([^<]+)</${name}>`).exec(body)?.[1]?.trim() || undefined

export const parseMultipartParts = Effect.fn('storage.parseMultipartParts')(function* (
  body: string,
) {
  return yield* Effect.forEach(body.matchAll(/<Part>([\s\S]*?)<\/Part>/g), (match, partIndex) => {
    const part = match[1] ?? ''

    return Schema.decodeUnknownEffect(MultipartPart)({
      partNumber: extractTag(part, 'PartNumber'),
      etag: extractTag(part, 'ETag')?.replace(/&quot;|&#0*34;|&#x0*22;/gi, '"'),
      size: extractTag(part, 'Size'),
    }).pipe(
      Effect.mapError(
        () =>
          new InvalidMultipartPart({
            partIndex,
            message: 'R2 returned an invalid multipart part',
          }),
      ),
    )
  })
})
