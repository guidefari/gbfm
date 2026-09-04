import { describe, expect, test } from 'vitest'
import { createRemoteD1, type RemoteD1Options } from '../../scripts/remote-d1'

const options = (fetchImplementation: NonNullable<RemoteD1Options['fetch']>) => ({
  accountId: 'account',
  apiToken: 'token',
  databaseId: 'database',
  fetch: fetchImplementation
})

type RemoteResult = {
  readonly success: boolean
  readonly results: ReadonlyArray<never>
  readonly meta: { readonly changes?: number }
  readonly error?: string
}

const response = (result: ReadonlyArray<RemoteResult>) =>
  new Response(JSON.stringify({ success: true, errors: [], result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

describe('remote D1 adapter', () => {
  test('sends each parameterized batch statement as a documented REST query', async () => {
    const requests: Array<{
      readonly url: string
      readonly method: string | undefined
      readonly authorization: string | null
      readonly contentType: string | null
      readonly body: string
    }> = []
    const recordingFetch: NonNullable<RemoteD1Options['fetch']> = async (url, init) => {
      const headers = new Headers(init.headers)
      requests.push({
        url,
        method: init.method,
        authorization: headers.get('Authorization'),
        contentType: headers.get('Content-Type'),
        body: await new Response(init.body).text()
      })
      return response([{ success: true, results: [], meta: { changes: 1 } }])
    }
    const database = createRemoteD1(options(recordingFetch))

    await database.batch([
      database.prepare('INSERT INTO one VALUES (?)').bind('one'),
      database.prepare('INSERT INTO two VALUES (?)').bind('two')
    ])

    expect(requests).toEqual([
      {
        url: 'https://api.cloudflare.com/client/v4/accounts/account/d1/database/database/query',
        method: 'POST',
        authorization: 'Bearer token',
        contentType: 'application/json',
        body: JSON.stringify({ sql: 'INSERT INTO one VALUES (?)', params: ['one'] })
      },
      {
        url: 'https://api.cloudflare.com/client/v4/accounts/account/d1/database/database/query',
        method: 'POST',
        authorization: 'Bearer token',
        contentType: 'application/json',
        body: JSON.stringify({ sql: 'INSERT INTO two VALUES (?)', params: ['two'] })
      }
    ])
  })

  test('validates every result when the response envelope succeeds', async () => {
    const failedFetch: NonNullable<RemoteD1Options['fetch']> = async () =>
      response([
        { success: true, results: [], meta: {} },
        { success: false, error: 'second failed', results: [], meta: {} }
      ])
    const database = createRemoteD1(options(failedFetch))

    await expect(database.prepare('SELECT 1; SELECT 2').all()).rejects.toThrow(
      'D1 statement 1 failed: second failed'
    )
  })

  test('reports a partial failure and does not start the next request window', async () => {
    const bodies: string[] = []
    let requestCount = 0
    const partiallyFailedFetch: NonNullable<RemoteD1Options['fetch']> = async (_url, init) => {
      const requestIndex = requestCount
      requestCount += 1
      bodies[requestIndex] = await new Response(init.body).text()
      return response([
        requestIndex === 1
          ? { success: false, error: 'second failed', results: [], meta: {} }
          : { success: true, results: [], meta: { changes: 1 } }
      ])
    }
    const database = createRemoteD1(options(partiallyFailedFetch))
    const statements = Array.from({ length: 9 }, (_, index) =>
      database.prepare('INSERT INTO records VALUES (?)').bind(index)
    )

    await expect(database.batch(statements)).rejects.toThrow('D1 statement 0 failed: second failed')
    expect(bodies).toEqual(
      Array.from({ length: 8 }, (_, index) =>
        JSON.stringify({ sql: 'INSERT INTO records VALUES (?)', params: [index] })
      )
    )
  })
})
