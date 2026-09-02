import { Schema } from 'effect'

export const QrPdfRequestSchema = Schema.Struct({
  kind: Schema.Literals(['mix', 'show']),
  slug: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  people: Schema.Array(Schema.NonEmptyString)
})

export type QrPdfRequest = typeof QrPdfRequestSchema.Type

export const QrPdfResponseSchema = Schema.Struct({
  url: Schema.NonEmptyString,
  cached: Schema.Boolean
})

export type QrPdfResponse = typeof QrPdfResponseSchema.Type

export const decodeQrPdfRequest = Schema.decodeUnknownEffect(QrPdfRequestSchema)
export const decodeQrPdfResponse = Schema.decodeUnknownEffect(QrPdfResponseSchema)
