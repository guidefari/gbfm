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
  test('sends parameterized statements in one documented REST batch request', async () => {
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
      return response([
        { success: true, results: [], meta: { changes: 1 } },
        { success: true, results: [], meta: { changes: 1 } }
      ])
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
        body: JSON.stringify({
          batch: [
            { sql: 'INSERT INTO one VALUES (?)', params: ['one'] },
            { sql: 'INSERT INTO two VALUES (?)', params: ['two'] }
          ]
        })
      }
    ])
  })

  test('does not send a request for an empty batch', async () => {
    const unexpectedFetch: NonNullable<RemoteD1Options['fetch']> = async () => {
      throw new Error('fetch must not be called')
    }
    const database = createRemoteD1(options(unexpectedFetch))

    await expect(database.batch([])).resolves.toEqual([])
  })

  test('rejects when any result in a batch failed', async () => {
    const failedFetch: NonNullable<RemoteD1Options['fetch']> = async () =>
      response([
        { success: true, results: [], meta: {} },
        { success: false, error: 'second failed', results: [], meta: {} }
      ])
    const database = createRemoteD1(options(failedFetch))

    await expect(
      database.batch([database.prepare('SELECT 1'), database.prepare('SELECT 2')])
    ).rejects.toThrow('D1 statement 1 failed: second failed')
  })

  test('rejects when the batch result count does not match the statement count', async () => {
    const incompleteFetch: NonNullable<RemoteD1Options['fetch']> = async () =>
      response([{ success: true, results: [], meta: {} }])
    const database = createRemoteD1(options(incompleteFetch))

    await expect(
      database.batch([database.prepare('SELECT 1'), database.prepare('SELECT 2')])
    ).rejects.toThrow('D1 batch returned 1 results for 2 statements')
  })
})
