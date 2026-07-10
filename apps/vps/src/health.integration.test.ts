import { ReadinessCheckFailedError } from '@gbfm/api/errors'
import { Effect } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AppType } from '@/app'
import { createWebHandler } from '@/http/routes'

const baseUrl = 'http://127.0.0.1:3003'

let honoApp: AppType
let liveServer: ReturnType<typeof createWebHandler> | undefined

const liveFetch = (request: Request) => {
  if (!liveServer) {
    throw new Error('Live server is not initialized')
  }

  return liveServer.handler(request)
}

const healthRequest = (path: string, init?: RequestInit) =>
  new Request(new URL(path, baseUrl).toString(), init)

const readJson = async (response: Response): Promise<unknown> => response.json()

const createServerWithDatabaseCheck = (check: Effect.Effect<void, ReadinessCheckFailedError>) =>
  createWebHandler(honoApp, {
    healthDatabase: { check }
  })

const expectJsonResponse = async (response: Response, status: number, body: unknown) => {
  expect(response.status).toBe(status)
  expect(await readJson(response)).toEqual(body)
}

afterAll(async () => {
  if (liveServer) {
    await liveServer.dispose()
  }
})

beforeAll(async () => {
  const mod = await import('@/app')
  honoApp = mod.default
  liveServer = createWebHandler(honoApp)
})

describe('Health endpoints', () => {
  it('GET /health/live returns liveness JSON without checking the database', async () => {
    let checks = 0
    const server = createServerWithDatabaseCheck(
      Effect.sync(() => {
        checks += 1
      })
    )

    try {
      await expectJsonResponse(await server.handler(healthRequest('/health/live')), 200, {
        ok: true
      })
      expect(checks).toBe(0)
    } finally {
      await server.dispose()
    }
  })

  it('GET /health/ready checks the configured database seam', async () => {
    let checks = 0
    const server = createServerWithDatabaseCheck(
      Effect.sync(() => {
        checks += 1
      })
    )

    try {
      await expectJsonResponse(await server.handler(healthRequest('/health/ready')), 200, {
        dbConnected: true
      })
      expect(checks).toBe(1)
    } finally {
      await server.dispose()
    }
  })

  it('GET /health returns the same readiness result', async () => {
    let checks = 0
    const server = createServerWithDatabaseCheck(
      Effect.sync(() => {
        checks += 1
      })
    )

    try {
      await expectJsonResponse(await server.handler(healthRequest('/health')), 200, {
        dbConnected: true
      })
      expect(checks).toBe(1)
    } finally {
      await server.dispose()
    }
  })

  it('serves readiness from the 5s cache on repeated successful calls', async () => {
    let checks = 0
    const server = createServerWithDatabaseCheck(
      Effect.sync(() => {
        checks += 1
      })
    )

    try {
      const first = await server.handler(healthRequest('/health/ready'))
      const second = await server.handler(healthRequest('/health/ready'))

      await expectJsonResponse(first, 200, { dbConnected: true })
      await expectJsonResponse(second, 200, { dbConnected: true })
      expect(checks).toBe(1)
    } finally {
      await server.dispose()
    }
  })

  it('caches readiness failures with a 500 response', async () => {
    let checks = 0
    const server = createServerWithDatabaseCheck(
      Effect.sync(() => {
        checks += 1
      }).pipe(
        Effect.flatMap(() => Effect.fail(new ReadinessCheckFailedError({ dbConnected: false })))
      )
    )

    try {
      const first = await server.handler(healthRequest('/health/ready'))
      const second = await server.handler(healthRequest('/health/ready'))

      await expectJsonResponse(first, 500, {
        _tag: 'ReadinessCheckFailedError',
        dbConnected: false
      })
      await expectJsonResponse(second, 500, {
        _tag: 'ReadinessCheckFailedError',
        dbConnected: false
      })
      expect(checks).toBe(1)
    } finally {
      await server.dispose()
    }
  })

  it('responds 404 to unsupported methods on health paths', async () => {
    const res = await liveFetch(healthRequest('/health/live', { method: 'POST' }))

    expect(res.status).toBe(404)
  })

  it('uses the live Postgres connection for readiness in integration', async () => {
    const response = await liveFetch(healthRequest('/health/ready'))

    expect(response.status).toBe(200)
    expect(await readJson(response)).toEqual({ dbConnected: true })
  })
})
