import { describe, expect, it } from 'vitest'
import {
  makeHealthAssertions,
  runHealthAssertions,
  type ApiFetch,
  type HealthAssertionBody
} from './health'

const baseUrl = 'http://127.0.0.1:3003'

describe('health assertions', () => {
  it('exposes curl commands for each health endpoint', () => {
    const assertions = makeHealthAssertions(baseUrl)

    expect(assertions.map((assertion) => assertion.curl)).toEqual([
      'curl -fsS "http://127.0.0.1:3003/health/live" | jq -e \'.ok == true\'',
      'curl -fsS "http://127.0.0.1:3003/health/ready" | jq -e \'.dbConnected == true\'',
      'curl -fsS "http://127.0.0.1:3003/health" | jq -e \'.dbConnected == true\''
    ])
  })

  it('runs the assertions through an injected fetch seam', async () => {
    const paths: string[] = []
    const fetchHealth: ApiFetch = (request) => {
      const path = new URL(request.url).pathname
      paths.push(path)

      return Response.json(bodyForPath(path))
    }

    const results = await runHealthAssertions({ baseUrl, fetch: fetchHealth })

    expect(paths).toEqual(['/health/live', '/health/ready', '/health'])
    expect(results.map((result) => result.status)).toEqual([200, 200, 200])
    expect(results.map((result) => result.body)).toEqual([
      { ok: true },
      { dbConnected: true },
      { dbConnected: true }
    ])
  })
})

function bodyForPath(path: string): HealthAssertionBody {
  switch (path) {
    case '/health/live':
      return { ok: true }
    case '/health/ready':
    case '/health':
      return { dbConnected: true }
    default:
      throw new Error(`Unexpected health path: ${path}`)
  }
}
