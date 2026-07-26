import { Schema } from 'effect'

const ErrorResponseSchema = Schema.Struct({
  error: Schema.optional(Schema.String)
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
