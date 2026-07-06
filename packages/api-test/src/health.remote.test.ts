import { describe, expect, it } from 'vitest'
import {
  API_URL,
  makeHealthAssertions,
  runHealthAssertion,
  type HealthAssertionPath
} from './health'

const configuredBaseUrl = process.env.GBFM_API_URL
const testBaseUrl = configuredBaseUrl ?? API_URL
const describeRemote = configuredBaseUrl ? describe : describe.skip

const assertionFor = (path: HealthAssertionPath) => {
  const assertion = makeHealthAssertions(testBaseUrl).find((item) => item.path === path)

  if (!assertion) {
    throw new Error(`Missing health assertion for ${path}`)
  }

  return assertion
}

describeRemote('VPS health API curl assertions', () => {
  it('curl -fsS "$GBFM_API_URL/health/live" | jq -e \'.ok == true\'', async () => {
    const assertion = assertionFor('/health/live')
    const result = await runHealthAssertion(assertion, { baseUrl: testBaseUrl })

    expect(result.status).toBe(assertion.expectedStatus)
    expect(result.body).toEqual(assertion.expectedBody)
  })

  it('curl -fsS "$GBFM_API_URL/health/ready" | jq -e \'.dbConnected == true\'', async () => {
    const assertion = assertionFor('/health/ready')
    const result = await runHealthAssertion(assertion, { baseUrl: testBaseUrl })

    expect(result.status).toBe(assertion.expectedStatus)
    expect(result.body).toEqual(assertion.expectedBody)
  })

  it('curl -fsS "$GBFM_API_URL/health" | jq -e \'.dbConnected == true\'', async () => {
    const assertion = assertionFor('/health')
    const result = await runHealthAssertion(assertion, { baseUrl: testBaseUrl })

    expect(result.status).toBe(assertion.expectedStatus)
    expect(result.body).toEqual(assertion.expectedBody)
  })
})
