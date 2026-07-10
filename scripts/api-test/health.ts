import { isDeepStrictEqual } from 'node:util'
import {
  HealthLiveResponse as HealthLiveResponseSchema,
  HealthReadyResponse as HealthReadyResponseSchema,
  type HealthLiveResponse,
  type HealthReadyResponse
} from '@gbfm/api/health'
import { Effect, Schema } from 'effect'
import { API_URL, colors, header, parseArgs, printResponse, separator } from './lib/common'

const { DIM, GREEN, RED } = colors

type HealthAssertionPath = '/health/live' | '/health/ready' | '/health'
type HealthAssertionBody = HealthLiveResponse | HealthReadyResponse

interface HealthAssertion {
  readonly name: string
  readonly method: 'GET'
  readonly path: HealthAssertionPath
  readonly expectedStatus: 200
  readonly expectedBody: HealthAssertionBody
  readonly curl: string
}

interface HealthAssertionResult {
  readonly status: number
  readonly headers: Headers
  readonly bodyText: string
  readonly body: HealthAssertionBody
}

const healthLiveBody: HealthLiveResponse = { ok: true }
const healthReadyBody: HealthReadyResponse = { dbConnected: true }

const makeHealthAssertions = (baseUrl: string): readonly HealthAssertion[] => [
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

const { verbose, help } = parseArgs(Bun.argv.slice(2))

if (help) {
  console.log(`Usage: bun run scripts/api-test/health.ts [-v|--verbose]

Check API health status.

Options:
  -v, --verbose     Show all response headers
  -h, --help        Show this help message

Environment:
  GBFM_API_URL      Base URL (default: http://127.0.0.1:3003)`)
  process.exit(0)
}

let healthy = true

for (const assertion of makeHealthAssertions(API_URL)) {
  header(assertion.name)
  console.log(`${DIM}${assertion.curl}${colors.NC}`)
  console.log('')

  try {
    const result = await runHealthAssertion(assertion)
    printResponse(
      {
        status: result.status,
        headers: result.headers,
        body: result.bodyText
      },
      verbose
    )
    console.log('')
    console.log(`${GREEN}✓ Assertion passed${colors.NC}`)
  } catch (error) {
    healthy = false
    console.log(`${RED}✗ Assertion failed${colors.NC}`)
    console.log(error instanceof Error ? error.message : String(error))
  }

  separator()
}

process.exit(healthy ? 0 : 1)

async function runHealthAssertion(assertion: HealthAssertion): Promise<HealthAssertionResult> {
  const response = await fetch(
    new Request(new URL(assertion.path, API_URL).toString(), { method: assertion.method })
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
    status: response.status,
    headers: response.headers,
    bodyText,
    body
  }
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
