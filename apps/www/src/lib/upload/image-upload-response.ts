import { Schema } from 'effect'

export interface PresignImageResponse {
  uploadUrl: string
  publicUrl: string
  key: string
  expiresInSeconds: number
}

const presignResponseSchema = Schema.Struct({
  uploadUrl: Schema.String,
  publicUrl: Schema.String,
  key: Schema.String,
  expiresInSeconds: Schema.Number
})

export const parsePresignImageResponse = (raw: unknown): PresignImageResponse =>
  Schema.decodeUnknownSync(presignResponseSchema)(raw)
