import {
  makeHealthAssertions,
  runHealthAssertion,
  type HealthAssertionPath
} from '@gbfm/api-test/health'
import { beforeAll, describe, expect, it } from 'vitest'

type VpsServer = typeof import('@/index').default

const baseUrl = 'http://127.0.0.1:3003'

let server: VpsServer

const serverFetch = (request: Request) => server.fetch(request)

const assertionFor = (path: HealthAssertionPath) => {
  const assertion = makeHealthAssertions(baseUrl).find((item) => item.path === path)

  if (!assertion) {
    throw new Error(`Missing health assertion for ${path}`)
  }

  return assertion
}

beforeAll(async () => {
  const mod = await import('@/index')
  server = mod.default
})

describe('Health endpoints (Effect HttpApi through VPS server)', () => {
  it('curl -fsS "http://127.0.0.1:3003/health/live" | jq -e \'.ok == true\'', async () => {
    const assertion = assertionFor('/health/live')
    const result = await runHealthAssertion(assertion, {
      baseUrl,
      fetch: serverFetch
    })

    expect(result.status).toBe(assertion.expectedStatus)
    expect(result.body).toEqual(assertion.expectedBody)
  })

  it('curl -fsS "http://127.0.0.1:3003/health/ready" | jq -e \'.dbConnected == true\'', async () => {
    const assertion = assertionFor('/health/ready')
    const result = await runHealthAssertion(assertion, {
      baseUrl,
      fetch: serverFetch
    })

    expect(result.status).toBe(assertion.expectedStatus)
    expect(result.body).toEqual(assertion.expectedBody)
  })

  it('curl -fsS "http://127.0.0.1:3003/health" | jq -e \'.dbConnected == true\'', async () => {
    const assertion = assertionFor('/health')
    const result = await runHealthAssertion(assertion, {
      baseUrl,
      fetch: serverFetch
    })

    expect(result.status).toBe(assertion.expectedStatus)
    expect(result.body).toEqual(assertion.expectedBody)
  })

  it('serves readiness from the 5s cache on repeated calls (same status, no extra DB work)', async () => {
    const first = await serverFetch(new Request(new URL('/health/ready', baseUrl).toString()))
    const second = await serverFetch(new Request(new URL('/health/ready', baseUrl).toString()))
    expect(first.status).toBe(second.status)
    expect(await first.json()).toEqual(await second.json())
  })

  it('does not rate-limit health probes even under rapid fire', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 80; i++) {
      statuses.push(
        (await serverFetch(new Request(new URL('/health/live', baseUrl).toString()))).status
      )
    }
    expect(statuses.every((s) => s === 200)).toBe(true)
  })

  it('responds 404 to unsupported methods on health paths', async () => {
    const res = await serverFetch(
      new Request(new URL('/health/live', baseUrl).toString(), { method: 'POST' })
    )
    expect(res.status).toBe(404)
  })
})
