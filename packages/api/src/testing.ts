import type { Schema } from 'effect'
import { Effect, SchemaParser } from 'effect'

// Lets a blackbox test decode a live Response against the same schema an HttpApiEndpoint declares, independent of which server produced it.
export const decodeResponseBody = async <S extends Schema.Codec<unknown, unknown, never>>(
  schema: S,
  response: Response
): Promise<S['Type']> => {
  const body: unknown = await response.json()
  return Effect.runPromise(SchemaParser.decodeUnknownEffect(schema)(body))
}
