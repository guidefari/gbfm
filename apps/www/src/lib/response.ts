import { Schema } from 'effect'

const ErrorResponseSchema = Schema.Struct({
  error: Schema.optional(Schema.String)
})

const UploadResponseSchema = Schema.Struct({
  url: Schema.String,
  key: Schema.String
})

export async function readResponseErrorMessage(res: Response, fallback: string): Promise<string> {
  const raw = await res.json().catch((): unknown => ({}))

  try {
    const decoded = Schema.decodeUnknownSync(ErrorResponseSchema)(raw)
    return decoded.error || fallback
  } catch {
    return fallback
  }
}

export async function readUploadResponse(res: Response): Promise<{ url: string; key: string }> {
  const raw = await res.json().catch((): unknown => ({}))

  try {
    return Schema.decodeUnknownSync(UploadResponseSchema)(raw)
  } catch {
    throw new Error('Invalid upload response')
  }
}
