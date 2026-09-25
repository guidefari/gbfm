import { Schema } from 'effect'

export async function dashboardJson<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<S['Type']> {
  const response = await fetch(input, init)

  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  const body: unknown = await response.json()

  return Schema.decodeUnknownPromise(schema)(body)
}

export async function dashboardCommand(input: RequestInfo | URL, init: RequestInit): Promise<void> {
  const response = await fetch(input, init)

  if (!response.ok) throw new Error(`Request failed (${response.status})`)
}

export const jsonRequest = (method: string, body: Schema.Json): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
