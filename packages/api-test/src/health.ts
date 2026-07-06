import { isDeepStrictEqual } from 'node:util'
import {
  HealthLiveResponse as HealthLiveResponseSchema,
  HealthReadyResponse as HealthReadyResponseSchema,
  type HealthLiveResponse,
  type HealthReadyResponse
} from '@gbfm/api/health'
import { Effect, Schema } from 'effect'

export const API_URL = process.env.GBFM_API_URL ?? 'http://127.0.0.1:3003'

export type ApiFetch = (request: Request) => Promise<Response> | Response

export type HealthAssertionPath = '/health/live' | '/health/ready' | '/health'

export type HealthAssertionBody = HealthLiveResponse | HealthReadyResponse

export interface HealthAssertion {
  readonly name: string
  readonly method: 'GET'
  readonly path: HealthAssertionPath
  readonly expectedStatus: 200
  readonly expectedBody: HealthAssertionBody
  readonly curl: string
}

export interface HealthAssertionOptions {
  readonly baseUrl?: string
  readonly fetch?: ApiFetch
}

export interface HealthAssertionResult {
  readonly assertion: HealthAssertion
  readonly status: number
  readonly headers: Headers
  readonly bodyText: string
  readonly body: HealthAssertionBody
}

const healthLiveBody: HealthLiveResponse = { ok: true }
const healthReadyBody: HealthReadyResponse = { dbConnected: true }

export function makeHealthAssertions(baseUrl = API_URL): readonly HealthAssertion[] {
  return [
    {
      name: 'GET /health/live returns liveness JSON',
      method: 'GET',
      path: '/health/live',
      expectedStatus: 200,
      expectedBody: healthLiveBody,
      curl: `${curlGet(baseUrl, '/health/live')} | jq -e '.ok == true'`
    },
    {
      name: 'GET /health/ready returns readiness JSON',
      method: 'GET',
      path: '/health/ready',
      expectedStatus: 200,
      expectedBody: healthReadyBody,
      curl: `${curlGet(baseUrl, '/health/ready')} | jq -e '.dbConnected == true'`
    },
    {
      name: 'GET /health returns readiness JSON',
      method: 'GET',
      path: '/health',
      expectedStatus: 200,
      expectedBody: healthReadyBody,
      curl: `${curlGet(baseUrl, '/health')} | jq -e '.dbConnected == true'`
    }
  ]
}

export async function runHealthAssertion(
  assertion: HealthAssertion,
  options: HealthAssertionOptions = {}
): Promise<HealthAssertionResult> {
  const baseUrl = options.baseUrl ?? API_URL
  const send = options.fetch ?? fetchRequest
  const response = await send(
    new Request(new URL(assertion.path, baseUrl).toString(), { method: assertion.method })
  )
  const bodyText = await response.text()

  if (response.status !== assertion.expectedStatus) {
    throw new Error(
      `${assertion.curl} expected status ${assertion.expectedStatus} but received ${response.status}: ${bodyText}`
    )
  }

  const rawBody = parseJsonBody(bodyText, assertion)
  const body = await Effect.runPromise(decodeHealthBody(assertion.path, rawBody))

  if (!isDeepStrictEqual(body, assertion.expectedBody)) {
    throw new Error(
      `${assertion.curl} expected body ${JSON.stringify(assertion.expectedBody)} but received ${JSON.stringify(body)}`
    )
  }

  return {
    assertion,
    status: response.status,
    headers: response.headers,
    bodyText,
    body
  }
}

export async function runHealthAssertions(
  options: HealthAssertionOptions = {}
): Promise<readonly HealthAssertionResult[]> {
  const baseUrl = options.baseUrl ?? API_URL
  const results: HealthAssertionResult[] = []

  for (const assertion of makeHealthAssertions(baseUrl)) {
    results.push(await runHealthAssertion(assertion, options))
  }

  return results
}

function decodeHealthBody(
  path: HealthAssertionPath,
  body: unknown
): Effect.Effect<HealthAssertionBody, Schema.SchemaError> {
  switch (path) {
    case '/health/live':
      return Schema.decodeUnknownEffect(HealthLiveResponseSchema)(body)
    case '/health/ready':
    case '/health':
      return Schema.decodeUnknownEffect(HealthReadyResponseSchema)(body)
  }
}

function parseJsonBody(bodyText: string, assertion: HealthAssertion): unknown {
  try {
    return JSON.parse(bodyText)
  } catch (cause) {
    throw new Error(`${assertion.curl} returned non-JSON body`, { cause })
  }
}

function fetchRequest(request: Request) {
  return globalThis.fetch(request)
}

function curlGet(baseUrl: string, path: HealthAssertionPath) {
  return `curl -fsS ${shellQuote(new URL(path, baseUrl).toString())}`
}

function shellQuote(value: string) {
  return `"${value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('$', '\\$')
    .replaceAll('`', '\\`')}"`
}
