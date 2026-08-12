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

type PresignResponseInput =
  | string
  | number
  | boolean
  | null
  | readonly PresignResponseInput[]
  | { readonly [key: string]: PresignResponseInput }

export const parsePresignImageResponse = (raw: PresignResponseInput): PresignImageResponse =>
  Schema.decodeUnknownSync(presignResponseSchema)(raw)
